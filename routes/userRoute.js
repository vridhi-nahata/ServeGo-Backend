import express from "express";
import userAuth from "../middlewares/authMiddleware.js";
import { toggleWishlist } from "../controllers/userController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import { getUserData,getProvidersByService,getProviderProfile } from "../controllers/userController.js";
import { getMyBookings } from "../controllers/userController.js";

const userRouter= express.Router();

userRouter.get("/data",userAuth, getUserData);
userRouter.get("/providers-by-service", getProvidersByService);
userRouter.get("/provider-profile", getProviderProfile);
userRouter.post("/wishlist", authMiddleware, toggleWishlist);
userRouter.get("/my-bookings", userAuth, getMyBookings);

export default userRouter;