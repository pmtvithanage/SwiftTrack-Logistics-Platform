import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://lala:lala%23%24patronus78@cluster0.ezv2ieh.mongodb.net/?appName=Cluster0";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, { dbName: "SwiftTrack" });
    console.log("✅ ESB connected to MongoDB (SwiftTrack)");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};
