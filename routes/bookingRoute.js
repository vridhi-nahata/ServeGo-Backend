import express from "express";
import Booking from "../models/Booking.js";
import userAuth from "../middlewares/authMiddleware.js";
import mongoose from "mongoose";

const router = express.Router();

// POST /api/bookings
router.post("/", userAuth, async (req, res) => {
  try {
    console.log("Booking Request Body:", req.body);
    const { provider, serviceName, date, timeSlot, notes } = req.body;

    //  Check required fields
    if (!provider || !serviceName || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check time order
    if (timeSlot.from >= timeSlot.to) {
      return res.status(400).json({
        success: false,
        message: "'From' time must be earlier than 'To' time",
      });
    }

    // Check for overlapping booking
    const existingBooking = await Booking.findOne({
      provider,
      date: new Date(date),
      $or: [
        {
          "timeSlot.from": { $lt: timeSlot.to },
          "timeSlot.to": { $gt: timeSlot.from },
        },
      ],
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "This time slot is already booked",
      });
    }

    // Prevent self-booking
    if (req.user.id === provider) {
      return res.status(400).json({
        success: false,
        message: "You can't book yourself.",
      });
    }

    // Create and save booking
    const booking = new Booking({
      customer: req.user.id,
      provider,
      serviceName,
      date,
      timeSlot,
      notes,
      statusHistory: [
        {
          status: "pending",
        },
      ],
    });

    await booking.save();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// GET /api/bookings/booked-slots?providerId=xxx&date=yyyy-mm-dd
router.get("/booked-slots", async (req, res) => {
  const { providerId, date } = req.query;
  if (!providerId || !date) {
    return res
      .status(400)
      .json({ success: false, message: "Missing providerId or date" });
  }

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      provider: providerId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    const bookedSlots = bookings.map((b) => ({
      from: b.timeSlot.from,
      to: b.timeSlot.to,
    }));
    return res.json({
      success: true,
      bookedSlots,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/provider-requests
router.get("/provider-requests", userAuth, async (req, res) => {
  try {
    console.log("➡️  Provider request hit");
    console.log("Logged-in user:", req.user);

    const providerId = req.user.id;

    if (!providerId) {
      console.log("❌ No provider ID found");
      return res
        .status(400)
        .json({ success: false, message: "No provider ID" });
    }

    const bookings = await Booking.find({ provider: providerId })
      // .populate("customer", "name email avatarUrl")
      .sort({ createdAt: -1 });

    console.log("✅ Bookings found:", bookings.length);
    res.json({ success: true, bookings });
  } catch (err) {
    console.error("🔥 Error in /provider-requests:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/bookings/:id/status
router.patch("/:id/status", userAuth, async (req, res) => {
  const { status, newTimeSlot } = req.body;
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    // Only provider can update
    if (booking.provider.toString() !== req.user.id)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    if (status === "update-time" && newTimeSlot) {
      booking.updatedSlot = newTimeSlot;
      booking.statusHistory.push({ status: "update-time" });
    } else if (["confirmed", "rejected"].includes(status)) {
      booking.statusHistory.push({ status });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }
    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/bookings/:id/customer-response
router.patch("/:id/customer-response", userAuth, async (req, res) => {
  const { response } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    if (booking.customer.toString() !== req.user.id)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    if (!["accepted", "rejected"].includes(response))
      return res
        .status(400)
        .json({ success: false, message: "Invalid response" });

    // Apply new time if accepted
    if (response === "accepted" && booking.updatedSlot) {
      booking.timeSlot = booking.updatedSlot; // move proposed time to main slot
    }

    // Clear updatedSlot in both accept/reject
    booking.updatedSlot = undefined;

    // Push to statusHistory
    const newStatus = response === "accepted" ? "confirmed" : "rejected";
    booking.statusHistory.push({ status: newStatus });

    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
