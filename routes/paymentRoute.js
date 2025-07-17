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
      //   email,
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

// Split payment link
router.post("/split-link", async (req, res) => {
  const { bookingId, emails } = req.body;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const splitAmount = Math.round((booking.totalAmount / emails.length) * 100); // in paise

    const results = [];

    for (const email of emails) {
      const link = await razorpay.paymentLink.create({
        amount: splitAmount,
        currency: "INR",
        description: `Split Payment for ${booking.serviceName}`,
        customer: { email },
        notify: { email: true, sms: true },
        // callback_url: "https://yourdomain.com/payment-success", // Optional
        callback_method: "get",
      });

      results.push({ email, link: link.short_url });
    }

    booking.splitLinksSent = results.map(({ email, link }) => ({
      email,
      link,
      paid: false,
    }));
    await booking.save();
    res.json({ success: true, results });
  } catch (err) {
    console.error("Split Payment Link Error:", err);
    res.status(500).json({ message: "Failed to generate payment links" });
  }
});

// Razorpay Webhook Handler
router.post(
  "/razorpay-webhook",
  express.json({ type: "application/json" }),
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;

    if (event === "payment_link.paid") {
      const payment = req.body.payload.payment_link.entity;
      const linkUrl = payment.short_url;

      const booking = await Booking.findOne({ "splitLinksSent.link": linkUrl });

      if (booking) {
        console.log("Booking found:", booking._id);

        // Mark this entry as paid
        for (let entry of booking.splitLinksSent) {
          if (entry.link === linkUrl) {
            entry.paid = true;
            console.log("Marked entry as paid:", entry.email || entry.userId);
          }
        }

        // Log all entries
        console.log("🔍 splitLinksSent statuses:");
        booking.splitLinksSent.forEach((e, i) => {
          console.log(` - Entry ${i}: paid =`, e.paid);
        });

        // Update paymentStatus
        const allPaid = booking.splitLinksSent.every((e) => e.paid);
        if (allPaid) {
          booking.paymentStatus = "paid";
        } else {
          booking.paymentStatus = "partial";
        }

        console.log("Final paymentStatus to save:", booking.paymentStatus);

        booking.markModified("splitLinksSent");
        booking.paymentMethod = "online";

        await booking.save();
        console.log("Booking updated successfully");
      }
    }

    res.status(200).json({ success: true });
  }
);

export default router;
