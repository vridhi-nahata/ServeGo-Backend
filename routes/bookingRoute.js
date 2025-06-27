import express from "express";
import Booking from "../models/Booking.js";
import userAuth from "../middlewares/authMiddleware.js";

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
    const bookings = await Booking.find({
      provider: providerId,
      date: new Date(date),
    });

    const bookedSlots = bookings.map((b) => b.timeSlot); // timeSlot = { from, to }
    res.json({ success: true, bookedSlots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
