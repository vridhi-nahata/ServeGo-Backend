import jwt from "jsonwebtoken";
import User from "../models/userModel.js"

const userAuth = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.json({ success: false, message: "Unauthorized access" });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    if (decodedToken.id && decodedToken.role) {
      req.user = {
        id: decodedToken.id,
        role: decodedToken.role,
      };
    } else {
      return res.json({ success: false, message: "Unauthorized access" });
    }

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
export default userAuth;
