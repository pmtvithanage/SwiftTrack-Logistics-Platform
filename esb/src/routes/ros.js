/**
 * ESB → ROS Proxy Routes
 * Forwards REST calls to Route Optimization System
 */
import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const ROS_URL = process.env.ROS_URL || "http://localhost:8001";
const CMS_URL = process.env.CMS_URL || "http://localhost:8000";

// Helper: update order status in CMS via SOAP
const syncCmsStatus = async (orderId, status) => {
  try {
    const fetch = (await import("node-fetch")).default;
    // Wrapper tag must NOT end with 'status' — CMS uses endswith() matching
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><order_status_update><orderID>${orderId}</orderID><status>${status}</status></order_status_update></soap:Body>
</soap:Envelope>`;
    await fetch(`${CMS_URL}/api/updateStatus`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xml,
      timeout: 5000,
    });
  } catch (e) {
    console.warn("⚠️  CMS status sync failed (non-blocking):", e.message);
  }
};

const rosProxy = async (method, path, body = null, headers = {}) => {
  const fetch = (await import("node-fetch")).default;
  const options = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${ROS_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

// ─── GET /ros/routes/optimize/:driverId ──────────────────────────────────────
router.get("/routes/optimize/:driverId", authenticate, async (req, res) => {
  try {
    const { status, data } = await rosProxy("GET", `/routes/optimize/${req.params.driverId}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── POST /ros/orders/accept ──────────────────────────────────────────────────
router.post("/orders/accept", authenticate, requireRole("driver"), async (req, res) => {
  try {
    let { status, data } = await rosProxy("POST", "/orders/accept", req.body);

    // If ROS doesn't know this driver yet, auto-register and retry once
    if (status === 404 && data?.detail === "Driver not found") {
      try {
        const rosUrl = process.env.ROS_URL || "http://localhost:8001";
        const fetch2 = (await import("node-fetch")).default;
        await fetch2(`${rosUrl}/drivers/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: req.user._id.toString(),
            driver_id: req.user.driver_id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            address: req.user.address || "",
          }),
        });
      } catch (regErr) {
        console.warn("⚠️  ROS driver auto-register failed:", regErr.message);
      }
      // Retry the accept
      const retry = await rosProxy("POST", "/orders/accept", req.body);
      status = retry.status;
      data   = retry.data;
    }

    if (status === 200) {
      // Driver accepted → customer portal advances to "ready" (out for pickup)
      await syncCmsStatus(req.body.order_id, "ready");
      await Notification.create({
        type: "status_update",
        title: "Order Accepted",
        message: `Driver ${req.body.driver_id} accepted order ${req.body.order_id}`,
        orderId: req.body.order_id,
        driverId: req.body.driver_id,
        priority: "medium",
      });
    }
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── POST /ros/orders/on-delivery ─────────────────────────────────────────────
router.post("/orders/on-delivery", authenticate, requireRole("driver"), async (req, res) => {
  try {
    const { status, data } = await rosProxy("POST", "/orders/on-delivery", req.body);
    if (status === 200) {
      // Sync status to CMS so customer portal shows "on_delivery"
      await syncCmsStatus(req.body.order_id, "on_delivery");
      // Update WMS status
      try {
        const net = (await import("net")).default;
        const wmsPort = parseInt(process.env.WMS_PORT) || 9999;
        const wmsHost = process.env.WMS_HOST || "127.0.0.1";
        const statusMsg = `event=update_status|orderId=${req.body.order_id}|status=on-delivery\n`;
        await new Promise((resolve) => {
          const client = new net.Socket();
          client.setTimeout(3000);
          client.connect(wmsPort, wmsHost, () => client.write(statusMsg));
          client.on("data", () => { client.destroy(); resolve(); });
          client.on("error", () => resolve());
          client.on("timeout", () => { client.destroy(); resolve(); });
        });
      } catch (_) {}

      await Notification.create({
        type: "status_update",
        title: "Order On Delivery",
        message: `Order ${req.body.order_id} is now on delivery`,
        orderId: req.body.order_id,
        driverId: req.body.driver_id,
        priority: "medium",
      });
    }
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── POST /ros/orders/deliver ─────────────────────────────────────────────────
router.post("/orders/deliver", authenticate, requireRole("driver"), async (req, res) => {
  try {
    const { status, data } = await rosProxy("POST", "/orders/deliver", req.body);
    if (status === 200) {
      // Sync status to CMS so customer portal shows "delivered"
      await syncCmsStatus(req.body.order_id, "delivered");
      // Update WMS status
      try {
        const net = (await import("net")).default;
        const wmsPort = parseInt(process.env.WMS_PORT) || 9999;
        const wmsHost = process.env.WMS_HOST || "127.0.0.1";
        const statusMsg = `event=update_status|orderId=${req.body.order_id}|status=delivered\n`;
        await new Promise((resolve) => {
          const client = new net.Socket();
          client.setTimeout(3000);
          client.connect(wmsPort, wmsHost, () => client.write(statusMsg));
          client.on("data", () => { client.destroy(); resolve(); });
          client.on("error", () => resolve());
          client.on("timeout", () => { client.destroy(); resolve(); });
        });
      } catch (_) {}

      await Notification.create({
        type: "status_update",
        title: "Order Delivered",
        message: `Order ${req.body.order_id} has been delivered`,
        orderId: req.body.order_id,
        driverId: req.body.driver_id,
        priority: "low",
      });
    }
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── GET /ros/orders ──────────────────────────────────────────────────────────
router.get("/orders", authenticate, async (req, res) => {
  try {
    const { status, data } = await rosProxy("GET", "/orders");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── GET /ros/orders/:orderId ─────────────────────────────────────────────────
router.get("/orders/:orderId", authenticate, async (req, res) => {
  try {
    const { status, data } = await rosProxy("GET", `/orders/${req.params.orderId}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

// ─── GET /ros/drivers ─────────────────────────────────────────────────────────
router.get("/drivers", authenticate, async (req, res) => {
  try {
    const { status, data } = await rosProxy("GET", "/drivers");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "ROS unavailable", error: err.message });
  }
});

export default router;
