import express from "express";
import userAuth from "../middlewares/authMiddleware.js";
import userModel from "../models/userModel.js";

const router = express.Router();

// POST /api/provider/availability
router.post("/availability", userAuth, async (req, res) => {
  try {
    const { availability } = req.body;

    if (!availability || !Array.isArray(availability)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid availability format" });
    }

    await userModel.findByIdAndUpdate(req.user.id, {
      availability,
    });

    return res.json({ success: true, message: "Availability saved" });
  } catch (err) {
    console.error("Error saving availability:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

export default router;
