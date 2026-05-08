const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const SellerBuyerRating = require("../models/SellerBuyerRating");
const BuyerSellerRating = require("../models/BuyerSellerRating");
const { auth } = require("../middleware/auth");

const router = express.Router();
const PAYMENT_METHODS = ["Cash on Delivery", "Credit Card"];
const CREDIT_CARD_EARNING_STATUSES = ["Processing", "Preparing", "Shipping", "Delivered"];

function addDays(baseDate, days) {
  const dt = new Date(baseDate);
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt;
}

function normalizePaymentMethod(value) {
  const candidate = String(value || "").trim();
  return PAYMENT_METHODS.includes(candidate) ? candidate : "Cash on Delivery";
}

function getDiscountedPrice(price, discountPercentage) {
  const basePrice = Math.max(0, Number(price || 0));
  const discount = Math.max(0, Math.min(100, Number(discountPercentage || 0)));
  return basePrice * (1 - discount / 100);
}

function validateCardDetails(cardDetails) {
  if (!cardDetails) return "Card details are required for Credit Card payment";
  const { cardNumber, cardHolder, cardExpiry, cardCVV } = cardDetails;
  if (!cardNumber || !/^\d{16}$/.test(cardNumber.replace(/\s/g, "")))
    return "Card number must be 16 digits";
  if (!cardHolder || !cardHolder.trim())
    return "Card holder name is required";
  if (!cardExpiry || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry))
    return "Expiry must be in MM/YY format";
  if (!cardCVV || !/^\d{3,4}$/.test(cardCVV))
    return "CVV must be 3 or 4 digits";
  return null;
}

function snapshotAddress(address = {}) {
  return {
    label: String(address.label || "Delivery Address").trim() || "Delivery Address",
    line1: String(address.line1 || address.addressLine || "").trim(),
    city: String(address.city || "").trim(),
    country: String(address.country || "").trim(),
    postalCode: String(address.postalCode || "").trim()
  };
}

function hasAddressDetails(address = {}) {
  return Boolean(
    address &&
    [address.line1, address.addressLine, address.city, address.country, address.postalCode].some((value) => String(value || "").trim())
  );
}

function resolveDeliveryAddress(order = {}, buyer = {}) {
  if (hasAddressDetails(order.deliveryAddress)) {
    return snapshotAddress(order.deliveryAddress);
  }

  const savedAddresses = Array.isArray(buyer.addresses) ? buyer.addresses : [];
  const fallbackAddress = savedAddresses.find((address) => address.isDefault) || savedAddresses[0];
  if (hasAddressDetails(fallbackAddress)) {
    return snapshotAddress(fallbackAddress);
  }

  if (hasAddressDetails(buyer)) {
    return snapshotAddress({
      label: "Buyer Profile Address",
      addressLine: buyer.addressLine,
      city: buyer.city,
      country: buyer.country
    });
  }

  return null;
}

function shouldCreditSellerEarnings(order, nextStatus) {
  if (order.sellerEarningsCredited) return false;

  if (order.paymentMethod === "Cash on Delivery") {
    return nextStatus === "Delivered";
  }

  if (order.paymentMethod === "Credit Card") {
    return CREDIT_CARD_EARNING_STATUSES.includes(nextStatus);
  }

  return false;
}

async function rollbackOrderStock(order) {
  const updates = (order.products || []).map((item) => ({
    updateOne: {
      filter: {
        _id: item.productId,
        sellerId: order.sellerId
      },
      update: {
        $inc: {
          inventory: Number(item.quantity || 0)
        }
      }
    }
  }));

  if (updates.length) {
    await Product.bulkWrite(updates);
  }
}

async function refreshSellerRatingSummary(sellerId) {
  const stats = await BuyerSellerRating.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: "$sellerId",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const summary = {
    sellerRating: Number(stats[0]?.averageRating || 0),
    sellerReviewCount: Number(stats[0]?.reviewCount || 0)
  };

  await User.findByIdAndUpdate(sellerId, { $set: summary });
  return summary;
}



/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order placement and management for buyers and sellers
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Place a new order (buyer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                       example: "64a1f2b3c4d5e6f7a8b9c0d4"
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *               paymentMethod:
 *                 type: string
 *                 enum: ["Cash on Delivery", "Credit Card"]
 *                 example: "Cash on Delivery"
 *               deliveryAddressId:
 *                 type: string
 *                 description: ID of a saved address (uses default if omitted)
 *               cardDetails:
 *                 type: object
 *                 description: Required only when paymentMethod is "Credit Card"
 *                 properties:
 *                   cardNumber:
 *                     type: string
 *                     example: "4111111111111111"
 *                   cardHolder:
 *                     type: string
 *                     example: "John Doe"
 *                   cardExpiry:
 *                     type: string
 *                     example: "12/26"
 *                   cardCVV:
 *                     type: string
 *                     example: "123"
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error (missing items, out of stock, mixed sellers, invalid card)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post("/", auth("buyer"), async (req, res) => {
  try {
    const { items, paymentMethod, cardDetails, deliveryAddressId, deliveryAddress: requestDeliveryAddress } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "items[] is required" });
    }

    const resolvedMethod = normalizePaymentMethod(paymentMethod);
    if (resolvedMethod === "Credit Card") {
      const cardError = validateCardDetails(cardDetails);
      if (cardError) return res.status(400).json({ message: cardError });
    }

    const buyer = await User.findById(req.user.id).select("addresses");
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });

    const addresses = Array.isArray(buyer.addresses) ? buyer.addresses : [];
    if (!addresses.length && !hasAddressDetails(requestDeliveryAddress)) {
      return res.status(400).json({ message: "Please add at least one delivery address before placing an order" });
    }

    const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
    const selectedAddress = deliveryAddressId
      ? addresses.find((address) => String(address._id) === String(deliveryAddressId))
      : defaultAddress;

    const addressToSnapshot = hasAddressDetails(requestDeliveryAddress)
      ? requestDeliveryAddress
      : selectedAddress || defaultAddress || null;

    if (!addressToSnapshot) {
      return res.status(400).json({ message: "Please select a valid delivery address" });
    }

    const deliveryAddress = snapshotAddress(addressToSnapshot);
    if (!hasAddressDetails(deliveryAddress)) {
      return res.status(400).json({ message: "Please provide a complete delivery address" });
    }

    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) }, isActive: true });
    if (!products.length) return res.status(400).json({ message: "No valid products found" });

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const firstSeller = String(products[0].sellerId);

    const orderItems = [];
    let totalPrice = 0;
    let expectedDeliveryDays = 1;

    for (const rawItem of items) {
      const p = productMap.get(String(rawItem.productId));
      if (!p) continue;
      if (String(p.sellerId) !== firstSeller) {
        return res.status(400).json({ message: "Each order must contain products from one seller only" });
      }

      const quantity = Math.max(1, Number(rawItem.quantity || 1));
      const unitPrice = getDiscountedPrice(p.price, p.discountPercentage);
      orderItems.push({ productId: p._id, quantity, price: unitPrice });
      totalPrice += unitPrice * quantity;
      expectedDeliveryDays = Math.max(expectedDeliveryDays, Number(p.deliveryDays || 1));
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
        { $inc: { inventory: -item.quantity } }
      );

      if (!stockResult.modifiedCount) {
        if (appliedStockUpdates.length) {
          await Product.bulkWrite(
            appliedStockUpdates.map((u) => ({
              updateOne: {
                filter: { _id: u.productId },
                update: { $inc: { inventory: u.quantity } }
              }
            }))
          );
        }
        return res.status(400).json({ message: "One or more items are out of stock" });
      }

      appliedStockUpdates.push({ productId: item.productId, quantity: item.quantity });
    }

    const isCreditCard = resolvedMethod === "Credit Card";
    const orderData = {
      buyerId: req.user.id,
      sellerId: firstSeller,
      products: orderItems,
      status: "Placed",
      totalPrice,
      paymentMethod: resolvedMethod,
      paymentStatus: isCreditCard ? "Paid" : "Pending",
      sellerEarningsCredited: false,
      expectedDeliveryDays,
      expectedDeliveryDate: addDays(new Date(), expectedDeliveryDays),
      deliveryAddress
    };

    if (isCreditCard) {
      const rawNumber = cardDetails.cardNumber.replace(/\s/g, "");
      orderData.cardLast4 = rawNumber.slice(-4);
      orderData.cardHolderName = cardDetails.cardHolder.trim();
      orderData.cardExpiry = cardDetails.cardExpiry;
    }

    const order = await Order.create(orderData);
    return res.status(201).json(order);
  } catch (err) {
    return res.status(500).json({ message: "Failed to place order", error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/buyer/me:
 *   get:
 *     summary: Get the authenticated buyer's order history (buyer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders with detailed product and seller info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/buyer/me", auth("buyer"), async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.user.id }).sort({ createdAt: -1 }).lean();

    const sellerIds = [...new Set(orders.map((order) => String(order.sellerId)))];
    const orderIds = orders.map((order) => order._id);
    const productIds = [
      ...new Set(orders.flatMap((order) => (order.products || []).map((item) => String(item.productId))))
    ];

    const [sellers, products, sellerRatings] = await Promise.all([
      User.find({ _id: { $in: sellerIds } }).select("name").lean(),
      Product.find({ _id: { $in: productIds } }).select("name imageUrl sellerId deliveryDays").lean(),
      BuyerSellerRating.find({ orderId: { $in: orderIds }, buyerId: req.user.id }).lean()
    ]);

    const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller.name]));
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const ratingMap = new Map(sellerRatings.map((rating) => [String(rating.orderId), rating]));

    const payload = orders.map((order) => {
      const itemsDetailed = (order.products || []).map((item) => {
        const product = productMap.get(String(item.productId));
        return {
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          productName: product?.name || "Product",
          imageUrl: product?.imageUrl || "",
          sellerId: product?.sellerId || order.sellerId,
          sellerName: sellerMap.get(String(product?.sellerId || order.sellerId)) || "Seller",
          deliveryDays: Number(product?.deliveryDays || order.expectedDeliveryDays || 1)
        };
      });

      const orderRating = ratingMap.get(String(order._id));
      return {
        ...order,
        sellerName: sellerMap.get(String(order.sellerId)) || "Seller",
        productName: itemsDetailed[0]?.productName || `Order ${String(order._id).slice(-6)}`,
        itemsDetailed,
        sellerRating: orderRating
          ? {
              rating: Number(orderRating.rating || 0),
              comment: orderRating.comment || ""
            }
          : null
      };
    });

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/buyer/{id}:
 *   delete:
 *     summary: Remove a cancelled order from buyer history (buyer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Cancelled order removed from history
 *       400:
 *         description: Order is not cancelled — cannot remove
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.delete("/buyer/:id", auth("buyer"), async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyerId: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Cancelled") {
      return res.status(400).json({ message: "Only cancelled orders can be removed from history" });
    }

    await Order.deleteOne({ _id: order._id, buyerId: req.user.id });
    return res.json({ message: "Cancelled order removed" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove order", error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/buyer/{id}/cancel:
 *   patch:
 *     summary: Cancel an order and rollback stock (buyer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Order cancelled and stock restored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Order can no longer be cancelled (already Shipped or Delivered)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.patch("/buyer/:id/cancel", auth("buyer"), async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyerId: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Cancelled") {
      return res.json(order);
    }

    const cancellableStatuses = ["Placed", "Processing", "Preparing"];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ message: "Order can no longer be cancelled" });
    }

    await rollbackOrderStock(order);
    order.status = "Cancelled";
    await order.save();

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: "Failed to cancel order", error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/seller/rating:
 *   get:
 *     summary: Get the authenticated seller's average rating and review count (seller only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller rating summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rating:
 *                   type: number
 *                   example: 4.5
 *                 reviewCount:
 *                   type: integer
 *                   example: 20
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/seller/rating", auth("seller"), async (req, res) => {
  try {
    const stats = await BuyerSellerRating.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$sellerId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    if (stats.length) {
      const summary = await refreshSellerRatingSummary(req.user.id);
      return res.json({
        rating: summary.sellerRating,
        reviewCount: summary.sellerReviewCount
      });
    }

    const seller = await User.findById(req.user.id).select("sellerRating sellerReviewCount").lean();
    return res.json({
      rating: Number(seller?.sellerRating || 0),
      reviewCount: Number(seller?.sellerReviewCount || 0)
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller rating", error: err.message });
  }
});



/**
 * @swagger
 * /api/orders/seller/me:
 *   get:
 *     summary: Get the authenticated seller's incoming orders (seller only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders for this seller enriched with buyer and product info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/seller/me", auth("seller"), async (req, res) => {
  try {
    const orders = await Order.find({ sellerId: req.user.id }).sort({ createdAt: -1 }).lean();
    const buyerIds = [...new Set(orders.map((o) => String(o.buyerId)))];
    const orderIds = orders.map((o) => o._id);

    const [buyers, ratings] = await Promise.all([
      User.find({ _id: { $in: buyerIds } }).select("name addresses addressLine city country").lean(),
      SellerBuyerRating.find({ orderId: { $in: orderIds }, sellerId: req.user.id }).lean()
    ]);

    const buyerMap = new Map(buyers.map((b) => [String(b._id), b]));
    const ratingMap = new Map(ratings.map((r) => [String(r.orderId), r]));

    const productIds = [...new Set(orders.flatMap((o) => (o.products || []).map((p) => String(p.productId))))];
    const products = await Product.find({ _id: { $in: productIds } }).select("name").lean();
    const productMap = new Map(products.map((p) => [String(p._id), p.name]));

    const payload = orders.map((order) => {
      const firstItem = order.products?.[0];
      const r = ratingMap.get(String(order._id));
      const buyer = buyerMap.get(String(order.buyerId));
      const buyerName = buyer?.name || "Unknown";
      return {
        _id: order._id,
        id: String(order._id),
        buyerId: order.buyerId,
        buyer_id: order.buyerId,
        buyerName,
        buyer_name: buyerName,
        product: firstItem ? productMap.get(String(firstItem.productId)) || "Unknown product" : "No product",
        products: (order.products || []).map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          productName: productMap.get(String(item.productId)) || "Unknown product"
        })),
        status: order.status,
        totalPrice: order.totalPrice,
        total_amount: order.totalPrice,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        sellerEarningsCredited: order.sellerEarningsCredited,
        deliveryAddress: resolveDeliveryAddress(order, buyer),
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

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order status and credit seller earnings if applicable (seller only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Placed, Processing, Preparing, Shipping, Delivered, Cancelled]
 *                 example: Shipping
 *     responses:
 *       200:
 *         description: Updated order object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid status or trying to reopen a cancelled order
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/status", auth("seller"), async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ["Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findOne({ _id: req.params.id, sellerId: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({ message: "Cancelled orders cannot be reopened" });
    }

    const previousStatus = order.status;

    if (status === "Cancelled" && previousStatus !== "Cancelled") {
      await rollbackOrderStock(order);
    }

    const shouldCreditBalance = shouldCreditSellerEarnings(order, status);

    order.status = status;
    if (shouldCreditBalance) {
      order.paymentStatus = "Paid";
      order.sellerEarningsCredited = true;
    }

    // Older orders may be missing fields that are now required on order items.
    // Validate only the status/payment fields changed here so sellers can still
    // move those legacy orders to Delivered.
    await order.save({ validateModifiedOnly: true });

    if (shouldCreditBalance) {
      await User.findByIdAndUpdate(order.sellerId, { $inc: { balance: Number(order.totalPrice || 0) } });
    }



    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update order" });
  }
});

/**
 * @swagger
 * /api/orders/seller/ratings/buyer:
 *   post:
 *     summary: Seller rates a buyer for a completed order (seller only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, buyerId, rating]
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "64a1f2b3c4d5e6f7a8b9c0d3"
 *               buyerId:
 *                 type: string
 *                 example: "64a1f2b3c4d5e6f7a8b9c0d1"
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Great buyer, fast payment!"
 *     responses:
 *       201:
 *         description: Rating created or updated
 *       400:
 *         description: Missing required fields or invalid rating
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found for this buyer
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/orders/buyer/ratings/seller:
 *   post:
 *     summary: Buyer rates a seller for a completed order (buyer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, sellerId, rating]
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "64a1f2b3c4d5e6f7a8b9c0d3"
 *               sellerId:
 *                 type: string
 *                 example: "64a1f2b3c4d5e6f7a8b9c0d2"
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *               comment:
 *                 type: string
 *                 example: "Excellent seller, product as described!"
 *     responses:
 *       201:
 *         description: Rating created or updated, seller rating summary refreshed
 *       400:
 *         description: Missing required fields or invalid rating
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found for this seller
 *       500:
 *         description: Internal server error
 */
router.post("/buyer/ratings/seller", auth("buyer"), async (req, res) => {
  try {
    const { orderId, sellerId, rating, comment } = req.body || {};
    if (!orderId || !sellerId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "orderId, sellerId and rating (1-5) are required" });
    }

    const order = await Order.findOne({ _id: orderId, buyerId: req.user.id, sellerId });
    if (!order) return res.status(404).json({ message: "Order not found for this seller" });

    const doc = await BuyerSellerRating.findOneAndUpdate(
      { orderId, sellerId, buyerId: req.user.id },
      { rating: Number(rating), comment: String(comment || "").trim() },
      { new: true, upsert: true }
    );

    await refreshSellerRatingSummary(sellerId);

    return res.status(201).json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Failed to rate seller", error: err.message });
  }
});

module.exports = router;