import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    location: {
      country: { type: String, required: true },
      state: { type: String, required: true },
      city: { type: String, required: true },
      area: { type: String, required: true },
      pinCode: { type: String, required: true },
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
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    role: {
      type: String,
      enum: ["customer", "provider", "admin"],
      required: true,
    },
    avatarUrl: { type: String },

    // Provider-specific fields
    servicesOffered: [
      {
        category: { type: String, required: true },
        subcategory: { type: String, required: true },
        services: [{ type: String, required: true }],
      },
    ],
    experiencePerService: {
      type: Map,
      of: Number,
      default: {},
    },
    availability: [
      {
        day: { type: String, required: true },
        slots: [
          {
            from: { type: String, required: true },
            to: { type: String, required: true },
          },
        ],
      },
    ],
    serviceDocs: [{ type: String }],
  },
  { timestamps: true }
);

// User Model
const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
