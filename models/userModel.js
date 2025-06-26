import mongoose from "mongoose";
const SERVICES = [
  "Home Cleaning",
  "Physiotherapy",
  "Massage",
  "MakeUp",
  "Hairstyle",
  "Cooking",
  "Pest Control",
  "Painting",
  "Waterproofing",
  "AC Repair",
  "Electrician",
  "Plumber",
  "Carpenter",
  "Smart Device Repair",
  "IT Support",
  "Medical Lab Tests",
  "Nutritionist",
  "Photography",
  "Car Cleaning",
  "Tutoring",
  "Mounting",
  "Lifting",
];

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

    // Provider-specific fields
    servicesOffered: [{ type: String, enum: SERVICES, default: undefined }],
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
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

export { SERVICES };

// User Model
const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
