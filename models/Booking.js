import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
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
    type: String,
    required: true,
  },
  notes: {
    type: String,
  },
  status: {
  type: String,
  enum: ["pending", "confirmed", "completed", "cancelled"],
  default: "confirmed"
},
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;