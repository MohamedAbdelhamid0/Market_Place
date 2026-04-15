const mongoose = require("mongoose");

const flagSchema = new mongoose.Schema(
  {
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Flag", flagSchema);
