const express = require("express");
const { auth } = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

router.get("/seller/me/profile", auth("seller"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name businessName email supportEmail phone addressLine city country");
    if (!user) return res.status(404).json({ message: "Seller not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
});

router.patch("/seller/me/profile", auth("seller"), async (req, res) => {
  try {
    const allowed = ["name", "businessName", "email", "supportEmail", "phone", "addressLine", "city", "country"];
    const update = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
      }
    }

    if (update.email) {
      update.email = String(update.email).toLowerCase();
      const exists = await User.findOne({ email: update.email, _id: { $ne: req.user.id } });
      if (exists) return res.status(409).json({ message: "Email already used by another account" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select(
      "name businessName email supportEmail phone addressLine city country flags role"
    );
    if (!user) return res.status(404).json({ message: "Seller not found" });

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
});

module.exports = router;
