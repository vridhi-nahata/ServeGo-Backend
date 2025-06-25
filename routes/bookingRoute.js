import express from "express";
import Booking from "../models/Booking.js";
import userAuth from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /api/bookings
router.post("/", userAuth, async (req, res) => {
  try {
    const { provider, serviceName, date, timeSlot, notes } = req.body;

    //  Check required fields
    if (!provider || !serviceName || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Prevent self-booking
    if (req.user.id === provider) {
      return res.status(400).json({
        success: false,
        message: "You can't book yourself.",
      });
    }

    // Prevent double booking (same provider, date, and time)
    // const existingBooking = await Booking.findOne({
    //   provider,
    //   date: new Date(date),
    //   timeSlot,
    // });

    // if (existingBooking) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "This time slot is already booked for the provider.",
    //   });
    // }

    // Create and save booking
    const booking = new Booking({
      customer: req.user.id,
      provider,
      serviceName,
      date: new Date(date),
      timeSlot,
      notes,
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

export default router;
