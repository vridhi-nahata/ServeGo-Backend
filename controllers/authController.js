import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

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
    return res.json({ success: true ,user, message: "User registered successfully" });
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
