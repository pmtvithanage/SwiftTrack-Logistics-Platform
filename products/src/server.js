import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import productRouter from "./routes/productRouter.js";

dotenv.config();

const app = express();
connectDB();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/products", productRouter);

app.get("/health", (req, res) => res.json({ status: "ok", service: "SwiftTrack Products" }));
app.get("/", (req, res) => res.json({ message: "SwiftTrack Products Backend 🚀", version: "2.0.0" }));

const PORT = process.env.PORT || 5999;
app.listen(PORT, () => console.log(`✅ Products backend running on port ${PORT}`));
