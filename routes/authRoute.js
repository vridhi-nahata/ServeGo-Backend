import express from 'express'
import {register,login, logout,verifyEmail, verifyOtp} from '../controllers/authController.js'
import userAuth from '../middlewares/authMiddleware.js';
import transporter from '../utils/nodemailer.js';

// create authRouter
const authRouter=express.Router();

// API endpoints for router

// Public routes

// Register Route
authRouter.post('/register',register);
// Login Route
authRouter.post('/login',login);
// Logout Route
authRouter.post('/logout',logout);

// Protected routes

// Send OTP Route
authRouter.post('/send-verify-otp',userAuth,verifyEmail);
// Verify email using OTP Route
authRouter.post('/verify-account',userAuth,verifyOtp);

// Test Email Route
authRouter.get('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: "nahatavridhi@gmail.com", 
      subject: "Test Email from ServeGo",
      text: "If you're reading this, email sending works 🎉",
    });

    res.json({ success: true, message: "Test email sent successfully!" });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});


export default authRouter;