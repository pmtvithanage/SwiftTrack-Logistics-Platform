import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb+srv://lala:lala%23%24patronus78@cluster0.ezv2ieh.mongodb.net/?appName=Cluster0",
      { dbName: "products" }
    );
    console.log("✅ Products backend connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

export default connectDB;
