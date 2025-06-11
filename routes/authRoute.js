import express from "express";
import {register,login,logout,verifyEmail,verifyOtp,isAuthenticated, sendResetOtp,verifyResetOtp, resetPassword} from "../controllers/authController.js";
import userAuth from "../middlewares/authMiddleware.js";
import transporter from "../utils/nodemailer.js";
import { getUserData } from "../controllers/userController.js";

// create authRouter
const authRouter = express.Router();

// API endpoints for router

// Public routes

// Register Route
authRouter.post("/register", register);
// Login Route
authRouter.post("/login", login);
// Logout Route
authRouter.post("/logout", logout);

// Protected routes

// Send OTP Route
authRouter.post("/send-verify-otp", userAuth, verifyEmail);
// Verify email using OTP Route
authRouter.post("/verify-account", userAuth, verifyOtp);
// Check if user is authenticated
authRouter.get("/is-auth", userAuth, isAuthenticated);
// Send password reset OTP Route
authRouter.post("/send-reset-otp", sendResetOtp);
//Verify reset OTP Route
authRouter.post("/verify-reset-otp", verifyResetOtp);
//Reset password Route
authRouter.post("/reset-password", resetPassword);
// Get user data Route
authRouter.get("/data", userAuth, getUserData);

export default authRouter;
