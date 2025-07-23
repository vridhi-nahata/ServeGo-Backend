import express from "express";
import userAuth from "../middlewares/authMiddleware.js";
import { toggleWishlist } from "../controllers/userController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getUserData,
  getProvidersByService,
  getProviderProfile,
  getMyBookings,
  getProviderReviews,
} from "../controllers/userController.js";
import userModel from "../models/userModel.js";

const userRouter = express.Router();

userRouter.get("/data", userAuth, getUserData);
userRouter.get("/providers-by-service", getProvidersByService);
userRouter.get("/provider-profile", getProviderProfile);
userRouter.post("/wishlist", authMiddleware, toggleWishlist);
userRouter.get("/my-bookings", userAuth, getMyBookings);
userRouter.get("/provider-reviews/:providerId", getProviderReviews);
userRouter.get("/wishlist", userAuth, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).populate({
      path: "wishlist",
      model: "user", // or "user" if that's how you registered it
      select: "name avatarUrl servicesOffered availability location avgRating",
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // Defensive: filter out nulls if any referenced provider is missing
    const providers = (user.wishlist || []).filter(Boolean);
    res.json({ success: true, providers });
  } catch (err) {
    console.error("Wishlist error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
export default userRouter;
