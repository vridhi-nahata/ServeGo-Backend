import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  data: { type: Object, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
});

const pendingRegistration = mongoose.models.pendingRegistration || mongoose.model("PendingRegistration", pendingRegistrationSchema);

export default pendingRegistration;