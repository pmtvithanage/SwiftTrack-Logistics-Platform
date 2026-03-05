/**
 * ESB → Products Backend Proxy
 */
import express from "express";
import { authenticate } from "../middleware/auth.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const PRODUCTS_URL = process.env.PRODUCTS_URL || "http://localhost:5999";

const proxyToProducts = async (method, path, body = null) => {
  const fetch = (await import("node-fetch")).default;
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${PRODUCTS_URL}/api/products${path}`, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

router.get("/showProducts", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/showProducts?${qs}` : "/showProducts";
    const { status, data } = await proxyToProducts("GET", path);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Products backend unavailable", error: err.message });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const { status, data } = await proxyToProducts("GET", "/categories");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Products backend unavailable", error: err.message });
  }
});

router.get("/offers", async (req, res) => {
  try {
    const { status, data } = await proxyToProducts("GET", "/offers");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Products backend unavailable", error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { status, data } = await proxyToProducts("GET", `/${req.params.id}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Products backend unavailable", error: err.message });
  }
});

router.post("/decrement-count", authenticate, async (req, res) => {
  try {
    const { status, data } = await proxyToProducts("POST", "/decrement-count", req.body);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Products backend unavailable", error: err.message });
  }
});

export default router;
