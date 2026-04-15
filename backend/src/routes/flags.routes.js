const express = require("express");
const Flag = require("../models/Flag");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/", auth(), async (req, res) => {
  try {
    const { reportedUserId, reason, orderId, details } = req.body || {};
    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "reportedUserId and reason are required" });
    }

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) return res.status(404).json({ message: "Reported user not found" });

    const flag = await Flag.create({
      reportedUserId,
      reportedBy: req.user.id,
      reason: String(reason).trim(),
      details: String(details || "").trim(),
      orderId: orderId || null
    });

    reportedUser.flags += 1;
    await reportedUser.save();

    return res.status(201).json(flag);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create flag", error: err.message });
  }
});

router.get("/seller/reports", auth("seller"), async (_req, res) => {
  try {
    const reports = await Flag.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reportedUserId", "name email role")
      .populate("reportedBy", "name email role");
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch reports", error: err.message });
  }
});

module.exports = router;
