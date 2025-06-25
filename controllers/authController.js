import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import pendingRegistration from "../models/pendingRegistrationModel.js";
import transporter from "../utils/nodemailer.js";

// Send email verification OTP controller function
export const sendRegistrationOtp = async (req, res) => {
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
    avatarUrl,
  } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.json({ success: false, message: "Missing required fields" });
  }

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    // Generate a 6-digit verification otp
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Remove any existing pending registration for this email
    await pendingRegistration.deleteOne({ email });

    await pendingRegistration.create({
      email,
      data: {
        name,
        email,
        phone,
        password,
        role,
        servicesOffered,
        experienceYears,
        availability,
        serviceDocs,
        avatarUrl,
      },
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    });

    // Send OTP via email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Email Verification OTP",
      text: `Hello ${name},\n\nYour email verification OTP is: ${otp}.\n\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nServeGo Team`,
    };
    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      otp,
      message: "Verification OTP sent to your email.",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// User final registration controller function
export const finalizeRegistration = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const pending = await pendingRegistration.findOne({ email });
    if (!pending)
      return res.json({ success: false, message: "No OTP request found" });

    if (Date.now() > pending.expiresAt.getTime()) {
      await pendingRegistration.deleteOne({ email });
      return res.json({ success: false, message: "OTP expired" });
    }
    if (pending.otp !== otp)
      return res.json({ success: false, message: "Incorrect OTP" });

    const {
      name,
      phone,
      password,
      role,
      servicesOffered,
      experienceYears,
      availability,
      serviceDocs,
      avatarUrl,
    } = pending.data;

    // encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      isAccountVerified: true,
      ...(role === "provider" && {
        servicesOffered,
        experienceYears,
        availability,
        serviceDocs,
        avatarUrl,
      }),
    });

    await newUser.save();

    // token generation
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

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
      to: newUser.email,
      subject: "Welcome to ServeGo",
      text: `Hello ${newUser.name},\n\nThank you for registering with ServeGo! We're excited to have you on board.\n\nBest regards,\nServeGo Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");

    await pendingRegistration.deleteOne({ email });
    return res.json({
      success: true,
      user: newUser,
      message: "Registered successfully",
    });
  } catch (error) {
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
    if (
      user.role === "provider" &&
      (!user.servicesOffered || user.servicesOffered.length === 0)
    ) {
      return res.json({
        success: false,
        message: "Provider must have at least one service to login",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    // token generation for authentication
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      // 7 day expiry for cookie (in milliseconds)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, user, message: "Logged in successfully" });
  } catch (error) {
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

// Verify OTP controller function
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    return res.json({ success: false, message: "OTP is required" });
  }
  try {
    const user = await userModel.findById(req.user.id);
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

// Check if user is authenticated (logged in) controller function
export const isAuthenticated = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, user, message: "User is authenticated" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Send password reset OTP controller function
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.json({ success: false, message: "Email is required" });
  }
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Generate a 6-digit reset OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    // Save the OTP to the user document
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes
    await user.save();

    // Send reset OTP email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Hello ${
        user.name || "User"
      },\n\nYour password reset OTP is: ${otp}.\n\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nServeGo Team`,
    };
    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: "Password reset OTP sent on email.",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Verify Reset OTP before allowing to change password
export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.json({ success: false, message: "OTP is required" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.resetOtp !== otp) {
      return res.json({ success: false, message: "Incorrect OTP" });
    }

    if (Date.now() > user.resetOtpExpireAt) {
      return res.json({ success: false, message: "OTP expired" });
    }
    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

//Reset password controller function
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, OTP and new password are required",
    });
  }
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    // Check if the OTP is entered
    if (user.resetOtp === "") {
      return res.json({ success: false, message: "OTP is required" });
    }
    // Check if the OTP is correct
    if (user.resetOtp !== otp) {
      return res.json({ success: false, message: "Incorrect OTP" });
    }
    // Check if the OTP is expired
    if (Date.now() > user.resetOtpExpireAt) {
      return res.json({ success: false, message: "OTP expired" });
    }
    // OTP correct and not expired- reset the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;
    await user.save();
    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
