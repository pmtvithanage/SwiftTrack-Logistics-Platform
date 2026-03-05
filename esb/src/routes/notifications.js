import express from "express";
import Notification from "../models/Notification.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// ─── GET /notifications ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});

// ─── GET /notifications/driver/:driverId ──────────────────────────────────────
router.get("/driver/:driverId", authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [{ driverId: req.params.driverId }, { driverId: null }],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});

// ─── POST /notifications ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json({ notification });
  } catch (err) {
    res.status(500).json({ message: "Failed to create notification", error: err.message });
  }
});

// ─── PUT /notifications/:id/read ─────────────────────────────────────────────
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json({ notification });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read", error: err.message });
  }
});

// ─── DELETE /notifications (clear all) ───────────────────────────────────────
router.delete("/", authenticate, async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear notifications", error: err.message });
  }
});

export default router;
