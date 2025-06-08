import userModel from "../models/userModel.js";

export const getUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId).select("-password -verifyOtp -resetOtp"); // Exclude sensitive fields

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, userData:{
        name: user.name,
        isAccountVerified: user.isAccountVerified, 
    }});
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
}