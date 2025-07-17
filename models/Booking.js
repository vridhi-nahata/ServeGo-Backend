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
    paymentMethod: {
      type: String,
      enum: ["online", "cash", "split"],
      default: "cash", // or "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "cash_initiated"],
      default: "pending",
    },
    paidBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: Number,
        paymentId: String,
      },
    ],
    paymentId: String,
    unit: {
      type: String,
      default: "fixed",
    },
    units: {
      type: Number,
      default: 1,
    },
    serviceAmount: {
      type: Number,
      required: true,
    },
    platformFee: {
      type: Number,
      default: 5,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    splitLinksSent: [
      {
        email: String,
        link: String,
        paid: { type: Boolean, default: false },
      },
    ],
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
    customerFeedback: {
      rating: { type: Number },
      review: { type: String },
      date: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
