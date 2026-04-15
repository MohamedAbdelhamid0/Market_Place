const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["buyer", "seller"], required: true },
    flags: { type: Number, default: 0 },
    businessName: { type: String, trim: true },
    supportEmail: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    addressLine: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
