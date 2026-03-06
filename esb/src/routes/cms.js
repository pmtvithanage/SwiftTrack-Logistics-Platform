/**
 * ESB → CMS Proxy Routes
 * Translates REST requests to SOAP/XML and forwards to CMS service
 */
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const CMS_URL = process.env.CMS_URL || "http://localhost:8000";

// Helper: SOAP envelope wrapper
const soapEnvelope = (body) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;

// Helper: POST SOAP to CMS
const callCMS = async (path, soapBody) => {
  const fetch = (await import("node-fetch")).default;
  const response = await fetch(`${CMS_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soapEnvelope(soapBody),
    timeout: 10000,
  });
  const text = await response.text();
  return { status: response.status, text };
};

// Helper: escape special XML characters in user-supplied values
const escXml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Helper: parse simple XML value
const extractXmlValue = (xml, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};

// ─── POST /cms/orders ─────────────────────────────────────────────────────────
// Create a new order (customer portal)
router.post("/orders", authenticate, requireRole("customer"), async (req, res) => {
  try {
    const {
      order_id, customer_id, totalAmount, priority = "low", items = [], delivery_address,
    } = req.body;

    if (!order_id || !customer_id || !totalAmount) {
      return res.status(400).json({ message: "order_id, customer_id, totalAmount are required" });
    }

    // Normalise delivery_address — accept both plain string and {address, latitude, longitude}
    const addrStr    = typeof delivery_address === "string"
      ? delivery_address
      : (delivery_address?.address || "");
    const addrLat    = typeof delivery_address === "object" ? (delivery_address?.latitude  ?? null) : null;
    const addrLng    = typeof delivery_address === "object" ? (delivery_address?.longitude ?? null) : null;

    // Build items XML (escape all user-supplied values)
    const itemsXml = items
      .map(
        (item) =>
          `<item>
            <product_id>${escXml(item.product_id)}</product_id>
            <name>${escXml(item.name)}</name>
            <quantity>${escXml(item.quantity)}</quantity>
            <price>${escXml(item.price)}</price>
            <image>${escXml(item.image)}</image>
          </item>`
      )
      .join("");

    const soapBody = `<create_order>
      <orderID>${escXml(order_id)}</orderID>
      <customer_id>${escXml(customer_id)}</customer_id>
      <totalAmount>${escXml(totalAmount)}</totalAmount>
      <priority>${escXml(priority)}</priority>
      <delivery_address>${escXml(addrStr)}</delivery_address>
      <items>${itemsXml}</items>
    </create_order>`;

    const { status, text } = await callCMS("/orderService", soapBody);
    const cmsStatus = extractXmlValue(text, "status");

    if (cmsStatus === "Success") {
      // Forward order to WMS via TCP
      let wmsConfirmed = false;
      try {
        const net = (await import("net")).default;
        const wmsPort = parseInt(process.env.WMS_PORT) || 9999;
        const wmsHost = process.env.WMS_HOST || "127.0.0.1";

        const orderData = [
          `event=new_order`,
          `orderId=${order_id}`,
          `customer_id=${customer_id}`,
          `totalAmount=${totalAmount}`,
          `priority=${priority}`,
        ].join("|");

        await new Promise((resolve, reject) => {
          const client = new net.Socket();
          client.setTimeout(5000);
          client.connect(wmsPort, wmsHost, () => {
            client.write(orderData + "\n");
          });
          client.on("data", () => { client.destroy(); resolve(); });
          client.on("error", reject);
          client.on("timeout", () => { client.destroy(); resolve(); }); // non-blocking
        });
        wmsConfirmed = true;
      } catch (wmsErr) {
        console.warn("⚠️  WMS notification failed (non-blocking):", wmsErr.message);
      }

      // WMS confirmed → advance CMS status to "processing" (warehouse preparing)
      if (wmsConfirmed) {
        try {
          const fetch2 = (await import("node-fetch")).default;
          const procXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><order_status_update><orderID>${order_id}</orderID><status>processing</status></order_status_update></soap:Body>
</soap:Envelope>`;
          await fetch2(`${CMS_URL}/api/updateStatus`, {
            method: "POST",
            headers: { "Content-Type": "text/xml; charset=utf-8" },
            body: procXml,
          });
        } catch (e) {
          console.warn("⚠️  CMS processing update failed:", e.message);
        }
      }

      // Forward to ROS for route planning
      // Pass address string and coordinates (if known); ROS will auto-detect from district name if coords missing
      try {
        const fetch = (await import("node-fetch")).default;
        const rosUrl = process.env.ROS_URL || "http://localhost:8001";
        const rosAddr = { address: addrStr };
        if (addrLat !== null) rosAddr.latitude  = addrLat;
        if (addrLng !== null) rosAddr.longitude = addrLng;
        await fetch(`${rosUrl}/orders/ready-to-deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id,
            customer_name: req.user.name,
            customer_phone: req.user.phone,
            delivery_address: rosAddr,
            priority,
            totalAmount,
            status: "ready-to-deliver",
          }),
        });
      } catch (rosErr) {
        console.warn("⚠️  ROS order forwarding failed:", rosErr.message);
      }

      // Create notification
      await Notification.create({
        type: "new_order",
        title: "New Order Created",
        message: `Order ${order_id} has been created and is being processed.`,
        orderId: order_id,
        customerId: customer_id,
        priority,
      });

      return res.status(201).json({ message: "Order created successfully", order_id });
    } else {
      const errorMsg = extractXmlValue(text, "message") || "Order creation failed";
      return res.status(400).json({ message: errorMsg });
    }
  } catch (err) {
    console.error("CMS create order error:", err);
    res.status(500).json({ message: "Failed to create order", error: err.message });
  }
});

// ─── GET /cms/orders/:customerId ──────────────────────────────────────────────
router.get("/orders/:customerId", authenticate, async (req, res) => {
  try {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(`${CMS_URL}/getOrders/${req.params.customerId}`);
    const text = await response.text();

    // Parse XML orders
    const ordersMatch = [...text.matchAll(/<order>([\s\S]*?)<\/order>/g)];
    const orders = ordersMatch.map((m) => {
      const xml = m[1];
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((im) => {
        const itemXml = im[1];
        return {
          product_id: extractXmlValue(itemXml, "product_id"),
          name: extractXmlValue(itemXml, "name"),
          quantity: parseInt(extractXmlValue(itemXml, "quantity") || "1"),
          price: parseFloat(extractXmlValue(itemXml, "price") || "0"),
          image: extractXmlValue(itemXml, "image"),
        };
      });
      const totalAmount = parseFloat(extractXmlValue(xml, "totalAmount") || "0");
      return {
        id: extractXmlValue(xml, "_id"),
        order_id: extractXmlValue(xml, "orderID"),     // normalise key name
        orderID: extractXmlValue(xml, "orderID"),
        customer_id: extractXmlValue(xml, "customer_id"),
        total_price: totalAmount,                      // normalise key name
        totalAmount,
        priority: extractXmlValue(xml, "priority"),
        status: extractXmlValue(xml, "status"),
        delivery_address: extractXmlValue(xml, "delivery_address") || "",
        created_at: extractXmlValue(xml, "created_at"),
        updated_at: extractXmlValue(xml, "updated_at"),
        items,
      };
    });

    res.json({ orders, count: orders.length });
  } catch (err) {
    console.error("CMS get orders error:", err);
    res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
});

// ─── GET /cms/customer/:customerId ────────────────────────────────────────────
router.get("/customer/:customerId", authenticate, async (req, res) => {
  try {
    const soapBody = `<get_customer><customer_id>${req.params.customerId}</customer_id></get_customer>`;
    const { text } = await callCMS("/customerService", soapBody);
    const cmsStatus = extractXmlValue(text, "status");

    if (cmsStatus === "Success") {
      const customerXml = text.match(/<customer>([\s\S]*?)<\/customer>/)?.[1] || "";
      const customer = {
        customer_id: extractXmlValue(customerXml, "customer_id"),
        name: extractXmlValue(customerXml, "name"),
        email: extractXmlValue(customerXml, "email"),
        phone: extractXmlValue(customerXml, "phone"),
        role: extractXmlValue(customerXml, "role"),
      };
      res.json({ customer });
    } else {
      res.status(404).json({ message: extractXmlValue(text, "message") || "Customer not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch customer", error: err.message });
  }
});

export default router;
