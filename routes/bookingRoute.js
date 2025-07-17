import express from "express";
import User from "../models/userModel.js";
import Booking from "../models/Booking.js";
import userAuth from "../middlewares/authMiddleware.js";
import mongoose from "mongoose";
import dayjs from "dayjs";

const router = express.Router();

// POST /api/bookings
router.post("/", userAuth, async (req, res) => {
  try {
    console.log("Booking Request Body:", req.body);
    const { provider, serviceName, date, timeSlot, address, notes,unit,units, serviceAmount, platformFee ,totalAmount } = req.body;

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
      unit,
      units,
      serviceAmount,
      platformFee,
      totalAmount,
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
      .populate({ path: "customer", model: "user", select: "name avatarUrl" }) 
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error in /provider-requests:", err); 
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

// PATCH /api/bookings/:id/initiate-cash
router.patch("/:id/initiate-cash", async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  booking.paymentStatus = "cash_initiated";
  await booking.save();

  res.json({ message: "Cash payment initiated", booking });
});

// PATCH /api/bookings/:id/confirm-cash
router.patch("/:id/confirm-cash", userAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (req.user.id !== booking.provider.toString()) {
      return res.status(403).json({ message: "Only provider can confirm cash" });
    }

    booking.paymentStatus = "paid";
    booking.paymentMethod = "cash";

    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    console.error("Cash confirm error:", err);
    res.status(500).json({ message: "Server error" });
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

// POST /api/bookings/:id/feedback
// router.post("/:id/feedback", userAuth, async (req, res) => {
//   const { rating, review } = req.body;

//   try {
//     const booking = await Booking.findById(req.params.id);
//       console.log("Received feedback POST");

//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     booking.customerFeedback = {
//       rating,
//       review,
//       date: new Date(),
//     };
//     booking.statusHistory.push({ status: "completed", changedAt: new Date() });
// console.log("Saving booking...", booking.customerFeedback);

//     await booking.save();
//     res.json({ success: true, message: "Feedback submitted", booking });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });


// POST /api/bookings/:id/feedback
// router.post("/:id/feedback", userAuth, async (req, res) => {
//   console.log("🔔 Feedback route hit");

//   const bookingId = req.params.id;
//   const { rating, review } = req.body;
//   const userId = req.user.id;

//   console.log("Params:", bookingId);
//   console.log("Body:", rating, review);
//   console.log("User:", userId);

//   try {
//     const booking = await Booking.findById(bookingId);

//     if (!booking) {
//       return res.status(404).json({ success: false, message: "Booking not found" });
//     }

//     if (booking.customer.toString() !== userId) {
//       return res.status(403).json({ success: false, message: "Not authorized" });
//     }

//     booking.customerFeedback = { rating, review };
//     booking.completedByCustomer = true;

//     await booking.save();

//     console.log("✅ Booking updated with feedback");
//     return res.json({ success: true, message: "Feedback submitted" });
//   } catch (error) {
//     console.error("❌ Error submitting feedback:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// POST /api/bookings/:id/feedback
// router.post("/:id/feedback", userAuth, async (req, res) => {
//   const { rating, review } = req.body;

//   try {
//     const booking = await Booking.findById(req.params.id);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//   booking.customerFeedback = {
//   rating: Number(rating),
//   review: review,
//   date: new Date(),
// };

// console.log("Feedback body:", req.body); // should show rating and review

//     // ✅ Corrected line
//     booking.statusHistory.push({ status: "completed", changedAt: new Date() });

//     await booking.save();
//     res.json({ success: true, message: "Feedback submitted", booking });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// router.post("/:id/feedback", userAuth, async (req, res) => {
//   let { rating, review } = req.body;
//   console.log("Feedback body:", req.body); // 👈 LOG THIS

//   try {
//     const booking = await Booking.findById(req.params.id);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     // Convert rating to number if needed
//     rating = Number(rating);

//     booking.customerFeedback = {
//       rating,
//       review,
//       date: new Date(),
//     };
// booking.completedByCustomer = true;

//     // booking.statusHistory.push({ status: "completed", changedAt: new Date() });

//     await booking.save();
//     res.json({ success: true, message: "Feedback submitted", booking });
//   } catch (err) {
//     console.error("Error submitting feedback:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });


// // POST /api/bookings/:id/feedback
// router.post("/:id/feedback", userAuth, async (req, res) => {
//   try {
//     const booking = await Booking.findById(req.params.id);

//     if (!booking) {
//       return res.status(404).json({ error: "Booking not found" });
//     }

//     // Ensure only the customer who booked it can submit feedback
//     if (booking.customer.toString() !== req.user.id) {
//       return res.status(403).json({ error: "Unauthorized" });
//     }

//     const { rating, review } = req.body;

//     // ✅ Set all feedback fields properly
//     booking.customerFeedback = {
//       rating: Number(rating),   // Ensure it's a number
//       review: review || "",     // Ensure it's a string
//       date: new Date(),
//     };

//     // Optional: mark booking as completed by customer
//     booking.completedByCustomer = true;

//     await booking.save(); // ✅ Make sure to save

//     res.status(200).json({ message: "Feedback submitted successfully" });
//   } catch (err) {
//     console.error("Error submitting feedback:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

router.post("/:id/feedback", userAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { rating, review } = req.body;

    booking.customerFeedback = {
      rating: Number(rating),
      review: review || "",
      date: new Date(),
    };

    booking.markModified("customerFeedback"); // <-- Add this line

    booking.completedByCustomer = true;

    await booking.save();

    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (err) {
    console.error("Error submitting feedback:", err);
    res.status(500).json({ error: "Server error" });
  }
});



export default router;
