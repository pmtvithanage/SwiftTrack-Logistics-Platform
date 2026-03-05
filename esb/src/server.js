import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import cmsRoutes from "./routes/cms.js";
import rosRoutes from "./routes/ros.js";
import wmsRoutes from "./routes/wms.js";
import notificationRoutes from "./routes/notifications.js";
import productRoutes from "./routes/products.js";
import { createServer } from "http";
import { setupWebSocket } from "./websocket.js";

dotenv.config();

const app = express();
const server = createServer(app);

// Connect to DB
connectDB();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Routes
app.use("/auth", authRoutes);
app.use("/cms", cmsRoutes);
app.use("/ros", rosRoutes);
app.use("/wms", wmsRoutes);
app.use("/notifications", notificationRoutes);
app.use("/api/products", productRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SwiftTrack ESB", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "SwiftTrack ESB running 🚀", version: "2.0.0" });
});

// Setup WebSocket for real-time updates
setupWebSocket(server);

const PORT = process.env.PORT || 8290;
server.listen(PORT, () => {
  console.log(`✅ SwiftTrack ESB running on port ${PORT}`);
  console.log(`   Auth  → http://localhost:${PORT}/auth`);
  console.log(`   CMS   → http://localhost:${PORT}/cms`);
  console.log(`   ROS   → http://localhost:${PORT}/ros`);
  console.log(`   WMS   → http://localhost:${PORT}/wms`);
});
