const express = require("express");
const Flag = require("../models/Flag");
const User = require("../models/User");
const Order = require("../models/Order");
const { auth } = require("../middleware/auth");

const router = express.Router();
const BUYER_LATE_DELIVERY_REASON = "Late Delivery";
const SELLER_NOT_RECEIVED_REASON = "Package Not Received";
const LATE_DELIVERY_GRACE_DAYS = 3;

function addDays(baseDate, days) {
  const dt = new Date(baseDate);
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt;
}

router.post("/", auth(), async (req, res) => {
  try {
    const { reportedUserId, reason, orderId, details } = req.body || {};
    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "reportedUserId and reason are required" });
    }

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) return res.status(404).json({ message: "Reported user not found" });

    const normalizedReason = String(reason).trim();
    if ([BUYER_LATE_DELIVERY_REASON, SELLER_NOT_RECEIVED_REASON].includes(normalizedReason) && !orderId) {
      return res.status(400).json({ message: "orderId is required for this report reason" });
    }

    if (normalizedReason === BUYER_LATE_DELIVERY_REASON) {
      if (req.user.role !== "buyer") {
        return res.status(403).json({ message: "Only buyers can submit late delivery reports" });
      }

      const order = await Order.findOne({ _id: orderId, buyerId: req.user.id, sellerId: reportedUserId }).lean();
      if (!order) return res.status(404).json({ message: "Order not found for this seller" });

      const expectedDate = order.expectedDeliveryDate
        ? new Date(order.expectedDeliveryDate)
        : addDays(order.createdAt || new Date(), Number(order.expectedDeliveryDays || 3));
      const graceDeadline = addDays(expectedDate, LATE_DELIVERY_GRACE_DAYS);
      const now = new Date();
      const deliveredLate = order.status === "Delivered" && new Date(order.updatedAt || order.createdAt) > graceDeadline;
      const stillNotDeliveredAfterDeadline = order.status !== "Delivered" && now > graceDeadline;

      if (!deliveredLate && !stillNotDeliveredAfterDeadline) {
        return res.status(400).json({
          message: `Seller can be flagged for late delivery only after expected date + ${LATE_DELIVERY_GRACE_DAYS} days`
        });
      }
    }

    if (normalizedReason === SELLER_NOT_RECEIVED_REASON) {
      if (req.user.role !== "seller") {
        return res.status(403).json({ message: "Only sellers can submit package not received reports" });
      }

      const order = await Order.findOne({ _id: orderId, sellerId: req.user.id, buyerId: reportedUserId }).lean();
      if (!order) return res.status(404).json({ message: "Order not found for this buyer" });

      if (!["Shipping", "Delivered"].includes(order.status)) {
        return res.status(400).json({ message: "Order must be shipped before reporting non-receipt" });
      }
    }

    const flag = await Flag.create({
      reportedUserId,
      reportedBy: req.user.id,
      reason: normalizedReason,
      details: String(details || "").trim(),
      orderId: orderId || null,
      status: "Open"
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
    const status = String(_req.query.status || "").trim();
    const filter = {};

    if (["Open", "UnderReview", "Resolved", "Dismissed"].includes(status)) {
      filter.status = status;
    }

    const reports = await Flag.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reportedUserId", "name email role")
      .populate("reportedBy", "name email role")
      .populate("resolvedBy", "name email role");
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch reports", error: err.message });
  }
});

router.patch("/:id/status", auth("seller"), async (req, res) => {
  try {
    const nextStatus = String(req.body?.status || "").trim();
    const resolutionNote = String(req.body?.resolutionNote || "").trim();
    const allowed = ["Open", "UnderReview", "Resolved", "Dismissed"];

    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid report status" });
    }

    const report = await Flag.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = nextStatus;
    report.resolutionNote = resolutionNote;

    if (["Resolved", "Dismissed"].includes(nextStatus)) {
      report.resolvedBy = req.user.id;
      report.resolvedAt = new Date();
    } else {
      report.resolvedBy = undefined;
      report.resolvedAt = undefined;
    }

    await report.save();
    const hydrated = await Flag.findById(report._id)
      .populate("reportedUserId", "name email role")
      .populate("reportedBy", "name email role")
      .populate("resolvedBy", "name email role");

    return res.json(hydrated);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update report status", error: err.message });
  }
});

module.exports = router;
