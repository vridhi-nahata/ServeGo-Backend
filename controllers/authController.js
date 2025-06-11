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
      text: `Hello ${user.name},\n\nThank you for registering with us! We're excited to have you on board.\n\nBest regards,\nThe ServeGo Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");

    return res.json({ success: true ,user, message: "Registered successfully" });
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

    return res.json({ success: true ,user, message: "Logged in successfully" });
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
      text: `Hello ${user.name || 'User'},\n\nYour password reset OTP is: ${otp}.\n\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nServeGo Team`,
    };
    await transporter.sendMail(mailOptions);
    
    return res.json({ success: true, message: "Password reset OTP sent on email." });
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
    return res.json({ success: false, message: "Email, OTP and new password are required" });
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
    return res.json({ success: true, message: "Password has been reset successfully" });
  }
  catch (error) {
    return res.json({ success: false, message: error.message });
  }
}
