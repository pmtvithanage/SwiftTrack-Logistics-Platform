import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "swifttrack_super_secret_key_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Utility: generate token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// ─── POST /auth/signup ────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, address, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "Missing required fields: name, email, phone, password, role" });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (!["customer", "driver"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'customer' or 'driver'" });
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Generate customer_id for customers
    const customer_id = role === "customer" ? `CUST-${uuidv4().substring(0, 8).toUpperCase()}` : "";
    const driver_id   = role === "driver"   ? `DRV-${uuidv4().substring(0, 8).toUpperCase()}`  : "";

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role,
      address: address || "",
      customer_id,
      driver_id,
      location: {
        address: address || "",
        latitude: null,
        longitude: null,
      },
    });

    // If driver — also register in ROS DB via ESB-internal call
    if (role === "driver") {
      try {
        const rosUrl = process.env.ROS_URL || "http://localhost:8001";
        const fetch = (await import("node-fetch")).default;
        await fetch(`${rosUrl}/drivers/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user._id.toString(),
            driver_id,
            name,
            email: email.toLowerCase(),
            phone,
            address: address || "",
          }),
        });
      } catch (rosErr) {
        console.warn("⚠️  Could not register driver in ROS:", rosErr.message);
      }
    }

    // If customer — also register in CMS via SOAP
    if (role === "customer") {
      try {
        const cmsUrl = process.env.CMS_URL || "http://localhost:8000";
        const fetch = (await import("node-fetch")).default;
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <create_customer>
      <user_id>${user._id.toString()}</user_id>
      <customer_id>${customer_id}</customer_id>
      <name>${name}</name>
      <email>${email.toLowerCase()}</email>
      <phone>${phone}</phone>
      <address>${address || ""}</address>
    </create_customer>
  </soap:Body>
</soap:Envelope>`;
        await fetch(`${cmsUrl}/customerService`, {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8" },
          body: soapBody,
        });
      } catch (cmsErr) {
        console.warn("⚠️  Could not register customer in CMS:", cmsErr.message);
      }
    }

    const token = generateToken(user);

    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        customer_id: user.customer_id || null,
        driver_id: driver_id || null,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ── Backfill driver_id for drivers that were created before the schema fix ──
    if (user.role === "driver" && !user.driver_id) {
      user.driver_id = `DRV-${uuidv4().substring(0, 8).toUpperCase()}`;
      await User.findByIdAndUpdate(user._id, { driver_id: user.driver_id });
    }

    // ── Ensure driver is registered in ROS (idempotent) ──
    if (user.role === "driver" && user.driver_id) {
      try {
        const rosUrl = process.env.ROS_URL || "http://localhost:8001";
        const fetch2 = (await import("node-fetch")).default;
        await fetch2(`${rosUrl}/drivers/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user._id.toString(),
            driver_id: user.driver_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address || "",
          }),
        });
      } catch (rosErr) {
        console.warn("⚠️  ROS driver sync failed (non-blocking):", rosErr.message);
      }
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      idToken: token, // backward compat
      user: {
        id: user._id,
        uid: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        customer_id: user.customer_id || null,
        driver_id: user.driver_id || null,
        customClaims: { role: user.role },
        displayName: user.name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post("/logout", authenticate, async (req, res) => {
  try {
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed" });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// ─── PUT /auth/profile ────────────────────────────────────────────────────────
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const updates = {};
    if (name)    updates.name = name;
    if (phone)   updates.phone = phone;
    if (address) updates.address = address;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
});

// ─── PUT /auth/change-password ────────────────────────────────────────────────
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to change password", error: err.message });
  }
});

export default router;
