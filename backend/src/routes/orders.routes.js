const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const SellerBuyerRating = require("../models/SellerBuyerRating");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/", auth("buyer"), async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "items[] is required" });
    }

    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) }, isActive: true });
    if (!products.length) return res.status(400).json({ message: "No valid products found" });

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const firstSeller = String(products[0].sellerId);

    const orderItems = [];
    let totalPrice = 0;

    for (const rawItem of items) {
      const p = productMap.get(String(rawItem.productId));
      if (!p) continue;
      if (String(p.sellerId) !== firstSeller) {
        return res.status(400).json({ message: "Each order must contain products from one seller only" });
      }

      const quantity = Math.max(1, Number(rawItem.quantity || 1));
      orderItems.push({ productId: p._id, quantity, price: p.price });
      totalPrice += p.price * quantity;
    }

    if (!orderItems.length) {
      return res.status(400).json({ message: "No order items generated" });
    }

    const appliedStockUpdates = [];
    for (const item of orderItems) {
      const stockResult = await Product.updateOne(
        {
          _id: item.productId,
          sellerId: firstSeller,
          isActive: true,
          inventory: { $gte: item.quantity }
        },
        { $inc: { inventory: -item.quantity, orders: item.quantity } }
      );

      if (!stockResult.modifiedCount) {
        if (appliedStockUpdates.length) {
          await Product.bulkWrite(
            appliedStockUpdates.map((u) => ({
              updateOne: {
                filter: { _id: u.productId },
                update: { $inc: { inventory: u.quantity, orders: -u.quantity } }
              }
            }))
          );
        }
        return res.status(400).json({ message: "One or more items are out of stock" });
      }

      appliedStockUpdates.push({ productId: item.productId, quantity: item.quantity });
    }

    const order = await Order.create({
      buyerId: req.user.id,
      sellerId: firstSeller,
      products: orderItems,
      status: "Placed",
      totalPrice
    });

    return res.status(201).json(order);
  } catch (err) {
    return res.status(500).json({ message: "Failed to place order", error: err.message });
  }
});

router.get("/buyer/me", auth("buyer"), async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.user.id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
});

router.get("/seller/me", auth("seller"), async (req, res) => {
  try {
    const orders = await Order.find({ sellerId: req.user.id }).sort({ createdAt: -1 }).lean();
    const buyerIds = [...new Set(orders.map((o) => String(o.buyerId)))];
    const orderIds = orders.map((o) => o._id);

    const [buyers, ratings] = await Promise.all([
      User.find({ _id: { $in: buyerIds } }).select("name").lean(),
      SellerBuyerRating.find({ orderId: { $in: orderIds }, sellerId: req.user.id }).lean()
    ]);

    const buyerMap = new Map(buyers.map((b) => [String(b._id), b.name]));
    const ratingMap = new Map(ratings.map((r) => [String(r.orderId), r]));

    const productIds = [...new Set(orders.flatMap((o) => (o.products || []).map((p) => String(p.productId))))];
    const products = await Product.find({ _id: { $in: productIds } }).select("name").lean();
    const productMap = new Map(products.map((p) => [String(p._id), p.name]));

    const payload = orders.map((order) => {
      const firstItem = order.products?.[0];
      const r = ratingMap.get(String(order._id));
      return {
        _id: order._id,
        id: String(order._id),
        buyerId: order.buyerId,
        buyer_id: order.buyerId,
        buyerName: buyerMap.get(String(order.buyerId)) || "Unknown",
        buyer_name: buyerMap.get(String(order.buyerId)) || "Unknown",
        product: firstItem ? productMap.get(String(firstItem.productId)) || "Unknown product" : "No product",
        status: order.status,
        totalPrice: order.totalPrice,
        total_amount: order.totalPrice,
        createdAt: order.createdAt,
        created_at: order.createdAt,
        buyer_rating: r ? r.rating : null,
        buyer_rating_comment: r ? r.comment : ""
      };
    });

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller orders", error: err.message });
  }
});

router.patch("/:id/status", auth("seller"), async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ["Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findOne({ _id: req.params.id, sellerId: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update order", error: err.message });
  }
});

router.post("/seller/ratings/buyer", auth("seller"), async (req, res) => {
  try {
    const { orderId, buyerId, rating, comment } = req.body || {};
    if (!orderId || !buyerId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "orderId, buyerId and rating (1-5) are required" });
    }

    const order = await Order.findOne({ _id: orderId, sellerId: req.user.id, buyerId });
    if (!order) return res.status(404).json({ message: "Order not found for this buyer" });

    const doc = await SellerBuyerRating.findOneAndUpdate(
      { orderId, sellerId: req.user.id, buyerId },
      { rating: Number(rating), comment: String(comment || "").trim() },
      { new: true, upsert: true }
    );

    return res.status(201).json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Failed to rate buyer", error: err.message });
  }
});

module.exports = router;
