/**
 * ESB → WMS Proxy Routes
 * Communicates with WMS via TCP/IP proprietary protocol
 */
import express from "express";
import net from "net";
import { authenticate } from "../middleware/auth.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const WMS_HOST = process.env.WMS_HOST || "127.0.0.1";
const WMS_PORT = parseInt(process.env.WMS_PORT) || 9999;

// Helper: send TCP message to WMS and get response
const sendToWMS = (message) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = "";

    client.setTimeout(8000);

    client.connect(WMS_PORT, WMS_HOST, () => {
      const msgWithNewline = message.endsWith("\n") ? message : message + "\n";
      client.write(msgWithNewline);
    });

    client.on("data", (data) => {
      responseData += data.toString();
      if (responseData.includes("\n")) {
        client.destroy();
        // Parse key=value|key=value response
        const parsed = {};
        responseData
          .trim()
          .split("|")
          .forEach((pair) => {
            const [k, v] = pair.split("=");
            if (k) parsed[k.trim()] = v ? v.trim() : "";
          });
        resolve(parsed);
      }
    });

    client.on("timeout", () => {
      client.destroy();
      reject(new Error("WMS connection timeout"));
    });

    client.on("error", (err) => {
      reject(new Error(`WMS TCP error: ${err.message}`));
    });
  });
};

// ─── POST /wms/orders ─────────────────────────────────────────────────────────
router.post("/orders", authenticate, async (req, res) => {
  try {
    const { orderId, priority = "low", totalAmount = 0, ...rest } = req.body;
    if (!orderId) return res.status(400).json({ message: "orderId is required" });

    const tcpMsg = [
      `orderId=${orderId}`,
      `priority=${priority}`,
      `totalAmount=${totalAmount}`,
      ...Object.entries(rest).map(([k, v]) => `${k}=${JSON.stringify(v)}`),
    ].join("|");

    const result = await sendToWMS(tcpMsg);
    res.json({ wms: result });
  } catch (err) {
    console.warn("WMS error (non-blocking):", err.message);
    res.status(503).json({ message: "WMS unavailable", error: err.message });
  }
});

// ─── PUT /wms/orders/:orderId/status ─────────────────────────────────────────
router.put("/orders/:orderId/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status is required" });

    const tcpMsg = `event=update_status|orderId=${req.params.orderId}|status=${status}`;
    const result = await sendToWMS(tcpMsg);
    res.json({ wms: result });
  } catch (err) {
    console.warn("WMS status update error:", err.message);
    res.status(503).json({ message: "WMS unavailable", error: err.message });
  }
});

// ─── GET /wms/health ──────────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  try {
    const result = await sendToWMS("event=test");
    res.json({ status: "ok", wms: result });
  } catch (err) {
    res.status(503).json({ status: "unavailable", error: err.message });
  }
});

export default router;
