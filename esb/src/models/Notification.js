import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["new_order", "status_update", "route_change", "priority_change", "system"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: String, default: null },
    driverId: { type: String, default: null },
    customerId: { type: String, default: null },
    priority: { type: String, enum: ["high", "low", "medium"], default: "medium" },
    isRead: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
