import express from "express";
import User from "../models/UserModel.js";
import Booking from "../models/Booking.js";
import userAuth from "../middlewares/authMiddleware.js";
import mongoose from "mongoose";
import dayjs from "dayjs";

const router = express.Router();

// POST /api/bookings
router.post("/", userAuth, async (req, res) => {
  try {
    console.log("Booking Request Body:", req.body);
    const { provider, serviceName, date, timeSlot, address, notes } = req.body;

    //  Check required fields
    if (!provider || !serviceName || !date || !timeSlot || !address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
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
      address,
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
    const providerId = req.user.id;

    if (!providerId) {
      return res
        .status(400)
        .json({ success: false, message: "No provider ID" });
    }

    const bookings = await Booking.find({ provider: providerId })
      .populate({ path: "customer", model: "user", select: "name avatarUrl" }) // ✅ Matches your model name
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error in /provider-requests:", err); // 👈 log error

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
      booking.statusHistory.push({
        status: "update-time",
        changedAt: new Date(),
      });
    } else if (["confirmed", "rejected"].includes(status)) {
      booking.statusHistory.push({ status });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    // Allow completion only if OTP verified
    if (status === "completed") {
      if (!booking.otpVerified)
        return res
          .status(400)
          .json({ success: false, message: "OTP not verified yet" });

      booking.statusHistory.push({
        status: "completed",
        changedAt: new Date(),
      });
      await booking.save();
      return res.json({ success: true, booking });
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

    // Only the customer can act
    if (booking.customer.toString() !== req.user.id)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    const latestStatus = booking.statusHistory.at(-1)?.status;

    //  Block cancellation within 2 hours
    if (response === "cancelled") {
      const bookingDateTime = dayjs(
        `${booking.date} ${booking.timeSlot.from}`,
        "YYYY-MM-DD HH:mm"
      );
      const diffMins = bookingDateTime.diff(dayjs(), "minute");

      if (diffMins <= 120) {
        return res.status(400).json({
          success: false,
          message:
            "You can't cancel this booking within 2 hours of the start time",
        });
      }
    }

    if (!["accepted", "cancelled"].includes(response))
      return res
        .status(400)
        .json({ success: false, message: "Invalid response" });

    // Apply new time if accepted
    if (response === "accepted" && booking.updatedSlot) {
      booking.timeSlot = booking.updatedSlot; // move proposed time to main slot
    }

    // Clear updatedSlot in both accept/cancel
    booking.updatedSlot = undefined;

    // Push to statusHistory
    const newStatus = response === "accepted" ? "confirmed" : "cancelled";
    booking.statusHistory.push({ status: newStatus, changedAt: new Date() });

    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate OTP when booking start time is reached
router.get("/generate-otp/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    const status = booking.statusHistory.at(-1)?.status;
    const now = dayjs();
    const bookingTime = dayjs(
      `${dayjs(booking.date).format("YYYY-MM-DD")} ${booking.timeSlot.from}`,
      "YYYY-MM-DD HH:mm"
    );

    if (status !== "confirmed" || now.diff(bookingTime, "minute") < 0) {
      return res.status(400).json({
        success: false,
        message: "OTP can only be generated at start time",
      });
    }

    if (!booking.otp) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      booking.otp = otp;
      await booking.save();
    }

    res.json({ success: true, otp: booking.otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Provider verifies OTP
router.post("/verify-otp/:id", userAuth, async (req, res) => {
  const { otp } = req.body;
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id);

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    if (booking.provider.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "Only provider can verify OTP" });
    }

    const trimmedOtp = (otp || "").trim();
    console.log(booking.otp);
    console.log(trimmedOtp);

    if (!trimmedOtp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    if (booking.otp !== trimmedOtp) {
      return res.status(400).json({ success: false, message: "Incorrect OTP" });
    }

    booking.otpVerified = true;
    // booking.otp = undefined;
    booking.statusHistory.push({
      status: "in-progress",
      changedAt: new Date(),
    });

    await booking.save();

    return res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

//Patch mark complete
router.patch("/mark-complete/:id", userAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    const userId = req.user.id;
    if (
      userId !== booking.customer.toString() &&
      userId !== booking.provider.toString()
    ) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!booking.otpVerified) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not yet verified" });
    }

    if (userId === booking.customer.toString())
      booking.completedByCustomer = true;
    if (userId === booking.provider.toString())
      booking.completedByProvider = true;

    // If both have marked complete, push to statusHistory
    if (booking.completedByCustomer && booking.completedByProvider) {
      booking.statusHistory.push({
        status: "completed",
        changedAt: new Date(),
      });
    }

    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
