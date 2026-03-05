import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    discountPercent: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);
