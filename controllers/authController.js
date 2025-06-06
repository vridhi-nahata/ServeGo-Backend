import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../utils/nodemailer.js"

// User registration controller function
export const register = async (req, res) => {
const {
    name,
    email,
    phone,
    password,
    role,
    servicesOffered,
    experienceYears,
    availability,
    serviceDocs,
  } = req.body;

  if (!name || !email ||!phone || !password || !role) {
    return res.json({ success: false, message: "Missing Details" });
  }
  try {
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    // encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
    };

    if (role === "provider") {
      newUserData.servicesOffered = servicesOffered;
      newUserData.experienceYears = experienceYears;
      newUserData.availability = availability;
      newUserData.serviceDocs = serviceDocs; 
    }

    const user = new userModel(newUserData);
    await user.save();

    // token generation
    const token = jwt.sign({ id: user._id ,role:user.role}, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      // 7 day expiry for cookie (in milliseconds)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Sending welcome email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Welcome to ServeGo",
      text: `Hello ${user.name},\n\nThank you for registering with us! We're excited to have you on board.\n\nBest regards,\nYour Service Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");

    return res.json({ success: true ,user, message: "User registered successfully" });
  } 
  catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// User login controller function
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({
      success: false,
      message: "Email and Password are required",
    });
  }
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not registered" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    // token generation for authentication
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });


    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      // 7 day expiry for cookie (in milliseconds)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true ,user, message: "User logged in successfully" });
  } 
  catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Logout controller function
export const logout = async (req, res) => {
  try {
    // Remove the token key- clear the cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Send email verification OTP controller function
export const verifyEmail = async (req, res) => {
  try {
    const user = await userModel.findById( req.user.id);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if(user.isAccountVerified) {
      return res.json({ success: false, message: "Account already verified" });
    }

    // Generate a 6-digit verification otp
    const otp =String(Math.floor(100000 + Math.random() * 900000));
    // Save the otp to the user document  
    user.verifyOtp = otp; 
    user.verifyOtpExpireAt = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes   
    await user.save();

    // Send verification email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Email Verification OTP",
      text: `Hello ${user.name || 'User'},\n\nYour verification OTP is: ${otp}.\n\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nServeGo Team`,
    };
    await transporter.sendMail(mailOptions);
    
    return res.json({ success: true, message: "Verification OTP sent on email." });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Verify OTP controller function
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    return res.json({ success: false, message: "OTP is required" });
  }
  try {
    const user = await userModel.findById(req.user.id );
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isAccountVerified) {
      return res.json({ success: false, message: "Account already verified" });
    }

    // Check if the OTP is valid
    if (user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    // Check if the OTP is expired
    if (Date.now() > user.verifyOtpExpireAt) {
      return res.json({ success: false, message: "OTP expired" });
    }

    // OTP correct and not expired- mark the account as verified
    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    await user.save();

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
