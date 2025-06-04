import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    // validate:[validator.isEmail,"Email is required"]
  },
  password: {
    type: String,
    required: true,
  },
  verifyOtp: {
    type: String,
    default: "",
  },
  verifyOtpExpireAt: {
    type: Number,
    default: 0,
  },
  isAccountVerified: {
    type: Boolean,
    default: false,
  },
  resetOtp: {
    type: String,
    default: "",
  },
  resetOtpExpireAt: {
    type: Number,
    default: 0,
  },
  // phone:{
  //     type:String,
  //     required:true,
  // },
  // role:{
  //     type:String,
  //     required:[true,"User role is required"],
  //     enum:["Customer","Service Provider","Admin"]
  // },

  //this is only for service provider
  // serviceCategory:{
  //     type:String,
  // }
});

// User Model
const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
