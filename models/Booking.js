import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      from: { type: String, required: true }, // format "HH:mm"
      to: { type: String, required: true },
    },
    updatedSlot: {
      from: { type: String },
      to: { type: String },
    },
    notes: {
      type: String,
    },
    address: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      default: "",
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    completedByCustomer: {
      type: Boolean,
      default: false,
    },
    completedByProvider: {
      type: Boolean,
      default: false,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "pending",
            "confirmed",
            "rejected",
            "update-time",
            "in-progress",
            "completed",
            "cancelled",
          ],
          required: true,
        },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
