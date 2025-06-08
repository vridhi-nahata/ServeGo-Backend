import express from "express";
import {register,login,logout,verifyEmail,verifyOtp,isAuthenticated, sendResetOtp, resetPassword} from "../controllers/authController.js";
import userAuth from "../middlewares/authMiddleware.js";
import transporter from "../utils/nodemailer.js";

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
authRouter.post("/is-auth", userAuth, isAuthenticated);
// Send password reset OTP Route
authRouter.post("/send-reset-otp", sendResetOtp);
//Reset password Route
authRouter.post("/reset-password", resetPassword);

export default authRouter;
