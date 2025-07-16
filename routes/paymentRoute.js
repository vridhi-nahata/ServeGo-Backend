import express from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import Booking from "../models/Booking.js";

dotenv.config();
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

// Create Razorpay Order
router.post("/create-order", async (req, res) => {
  const { amount, bookingId } = req.body;

  try {
    const options = {
      amount: Math.round(Number(amount) * 100), // in paise
      currency: "INR",
      receipt: bookingId,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Verify Signature & Update Booking
router.post("/verify", async (req, res) => {
  const { response, bookingId, userId, amount } = req.body;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    response;

  try {
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Signature" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    const numericAmount = Number(amount);
    booking.paidBy.push({
      userId,
      amount: numericAmount,
      paymentId: razorpay_payment_id,
    });

    const totalPaid = booking.paidBy.reduce((sum, p) => sum + p.amount, 0);
    booking.paymentStatus =
      totalPaid >= booking.totalAmount ? "paid" : "partial";
    booking.paymentMethod = "online";

    await booking.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;
