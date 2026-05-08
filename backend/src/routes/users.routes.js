const express = require("express");
const { auth } = require("../middleware/auth");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

const router = express.Router();
const PAYMENT_METHODS = ["Cash on Delivery", "Credit Card"];

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

function normalizeAddress(rawAddress = {}) {
  return {
    label: String(rawAddress.label || "Home").trim() || "Home",
    line1: String(rawAddress.line1 || "").trim(),
    city: String(rawAddress.city || "").trim(),
    country: String(rawAddress.country || "").trim(),
    postalCode: String(rawAddress.postalCode || "").trim(),
    isDefault: Boolean(rawAddress.isDefault)
  };
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

async function buildBuyerCartPayload(userId) {
  const user = await User.findById(userId).select("cart").lean();
  const cart = Array.isArray(user?.cart) ? user.cart : [];
  const productIds = cart.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const items = cart
    .map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) return null;

      const quantity = Math.max(1, Number(item.quantity || 1));
      const originalPrice = Number(product.price || 0);
      const discountPercentage = Math.max(0, Math.min(100, Number(product.discountPercentage || 0)));
      const unitPrice = getDiscountedPrice(originalPrice, discountPercentage);
      const lineTotal = unitPrice * quantity;

      return {
        productId: product._id,
        productName: product.name,
        category: product.category || "General",
        imageUrl: product.imageUrl || "",
        sellerId: product.sellerId,
        unitPrice,
        originalPrice,
        discountPercentage,
        quantity,
        lineTotal,
        availableInventory: Number(product.inventory || 0),
        deliveryDays: Math.max(1, Number(product.deliveryDays || 1))
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    items,
    subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
  };
}

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Buyer and seller profile, cart, wishlist, and address management
 */

/**
 * @swagger
 * /api/users/seller/me/profile:
 *   get:
 *     summary: Get the authenticated seller's profile (seller only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller profile object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name: { type: string }
 *                 businessName: { type: string }
 *                 email: { type: string }
 *                 supportEmail: { type: string }
 *                 phone: { type: string }
 *                 addressLine: { type: string }
 *                 city: { type: string }
 *                 country: { type: string }
 *                 balance: { type: number }
 *                 sellerRating: { type: number }
 *                 sellerReviewCount: { type: integer }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Seller not found
 *       500:
 *         description: Internal server error
 */
router.get("/seller/me/profile", auth("seller"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name businessName email supportEmail phone addressLine city country balance sellerRating sellerReviewCount");
    if (!user) return res.status(404).json({ message: "Seller not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/seller/me/profile:
 *   patch:
 *     summary: Update the authenticated seller's profile (seller only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               businessName: { type: string }
 *               email: { type: string, format: email }
 *               supportEmail: { type: string, format: email }
 *               phone: { type: string }
 *               addressLine: { type: string }
 *               city: { type: string }
 *               country: { type: string }
 *     responses:
 *       200:
 *         description: Updated seller profile
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Email already in use
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/users/buyer/me/profile:
 *   get:
 *     summary: Get the authenticated buyer's profile (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Buyer profile with saved addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name: { type: string }
 *                 email: { type: string }
 *                 phone: { type: string }
 *                 addressLine: { type: string }
 *                 city: { type: string }
 *                 country: { type: string }
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Buyer not found
 *       500:
 *         description: Internal server error
 */
router.get("/buyer/me/profile", auth("buyer"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email phone addressLine city country addresses");
    if (!user) return res.status(404).json({ message: "Buyer not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch buyer profile", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/profile:
 *   patch:
 *     summary: Update the authenticated buyer's profile and/or addresses (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               addressLine: { type: string }
 *               city: { type: string }
 *               country: { type: string }
 *               addresses:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Updated buyer profile
 *       400:
 *         description: Invalid addresses format
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email already in use
 *       500:
 *         description: Internal server error
 */
router.patch("/buyer/me/profile", auth("buyer"), async (req, res) => {
  try {
    const allowed = ["name", "email", "phone", "addressLine", "city", "country"];
    const update = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
      }
    }

    if (req.body.addresses !== undefined) {
      if (!Array.isArray(req.body.addresses)) {
        return res.status(400).json({ message: "addresses must be an array" });
      }

      const normalized = req.body.addresses.map(normalizeAddress);
      if (normalized.some((address) => !address.line1 || !address.city || !address.country)) {
        return res.status(400).json({ message: "Each address must include line1, city and country" });
      }

      let defaultExists = normalized.some((address) => address.isDefault);
      if (!defaultExists && normalized.length) {
        normalized[0].isDefault = true;
        defaultExists = true;
      }

      if (defaultExists) {
        let defaultFound = false;
        update.addresses = normalized.map((address) => {
          if (address.isDefault && !defaultFound) {
            defaultFound = true;
            return address;
          }
          return { ...address, isDefault: false };
        });
      } else {
        update.addresses = normalized;
      }
    }

    if (update.email) {
      update.email = String(update.email).toLowerCase();
      const exists = await User.findOne({ email: update.email, _id: { $ne: req.user.id } });
      if (exists) return res.status(409).json({ message: "Email already used by another account" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select(
      "name email phone addressLine city country addresses role"
    );
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update buyer profile", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/addresses:
 *   post:
 *     summary: Add a new delivery address to buyer profile (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Updated addresses array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 *       400:
 *         description: Missing required address fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Buyer not found
 *       500:
 *         description: Internal server error
 */
router.post("/buyer/me/addresses", auth("buyer"), async (req, res) => {
  try {
    const address = normalizeAddress(req.body || {});
    if (!address.line1 || !address.city || !address.country) {
      return res.status(400).json({ message: "line1, city and country are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    if (!Array.isArray(user.addresses)) user.addresses = [];
    if (address.isDefault || !user.addresses.length) {
      user.addresses = user.addresses.map((item) => ({ ...item.toObject(), isDefault: false }));
      address.isDefault = true;
    }

    user.addresses.push(address);
    await user.save();

    return res.status(201).json(user.addresses);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add address", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/addresses/{addressId}:
 *   delete:
 *     summary: Delete a saved delivery address (buyer only — must keep at least one)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: Address subdocument ObjectId
 *     responses:
 *       200:
 *         description: Updated addresses array after deletion
 *       400:
 *         description: Cannot delete last address
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address or buyer not found
 *       500:
 *         description: Internal server error
 */
router.delete("/buyer/me/addresses/:addressId", auth("buyer"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    const existing = user.addresses.id(req.params.addressId);
    if (!existing) return res.status(404).json({ message: "Address not found" });
    if (user.addresses.length <= 1) {
      return res.status(400).json({ message: "At least one delivery address is required" });
    }

    const wasDefault = Boolean(existing.isDefault);
    existing.deleteOne();

    if (wasDefault && user.addresses.length) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return res.json(user.addresses);
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete address", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart:
 *   get:
 *     summary: Get the authenticated buyer's cart with live product pricing (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart payload with items, subtotal, and item count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CartItem'
 *                 subtotal:
 *                   type: number
 *                   example: 199.98
 *                 itemCount:
 *                   type: integer
 *                   example: 2
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/buyer/me/cart", auth("buyer"), async (req, res) => {
  try {
    const payload = await buildBuyerCartPayload(req.user.id);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch cart", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart/items:
 *   post:
 *     summary: Add an item to the cart (buyer only — increments if already exists)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId:
 *                 type: string
 *                 example: "64a1f2b3c4d5e6f7a8b9c0d4"
 *               quantity:
 *                 type: integer
 *                 default: 1
 *                 example: 2
 *     responses:
 *       201:
 *         description: Updated cart payload
 *       400:
 *         description: productId is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.post("/buyer/me/cart/items", auth("buyer"), async (req, res) => {
  try {
    const productId = req.body?.productId;
    const quantity = Math.max(1, Number(req.body?.quantity || 1));

    if (!productId) return res.status(400).json({ message: "productId is required" });

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    const found = user.cart.find((item) => String(item.productId) === String(productId));
    if (found) {
      found.quantity += quantity;
    } else {
      user.cart.push({ productId, quantity });
    }

    await user.save();
    const payload = await buildBuyerCartPayload(req.user.id);
    return res.status(201).json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add item to cart", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart/items/{productId}:
 *   patch:
 *     summary: Update quantity of a cart item (quantity=0 removes the item) (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 3
 *     responses:
 *       200:
 *         description: Updated cart payload
 *       400:
 *         description: Invalid quantity
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch("/buyer/me/cart/items/:productId", auth("buyer"), async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity must be a valid number >= 0" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    user.cart = user.cart.filter((item) => {
      if (String(item.productId) !== String(req.params.productId)) return true;
      if (quantity === 0) return false;
      item.quantity = Math.max(1, Math.floor(quantity));
      return true;
    });

    await user.save();
    const payload = await buildBuyerCartPayload(req.user.id);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update cart item", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart/items/{productId}:
 *   delete:
 *     summary: Remove a specific item from the cart (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated cart payload after removal
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Buyer not found
 *       500:
 *         description: Internal server error
 */
router.delete("/buyer/me/cart/items/:productId", auth("buyer"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    user.cart = user.cart.filter((item) => String(item.productId) !== String(req.params.productId));
    await user.save();

    const payload = await buildBuyerCartPayload(req.user.id);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove item from cart", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart:
 *   delete:
 *     summary: Clear the entire cart (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Empty cart payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, example: [] }
 *                 subtotal: { type: number, example: 0 }
 *                 itemCount: { type: integer, example: 0 }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/buyer/me/cart", auth("buyer"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Buyer not found" });

    user.cart = [];
    await user.save();
    return res.json({ items: [], subtotal: 0, itemCount: 0 });
  } catch (err) {
    return res.status(500).json({ message: "Failed to clear cart", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/wishlist:
 *   get:
 *     summary: Get the authenticated buyer's wishlist (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of wishlisted active products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/buyer/me/wishlist", auth("buyer"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("wishlist").lean();
    const wishlistIds = Array.isArray(user?.wishlist) ? user.wishlist : [];

    const products = await Product.find({ _id: { $in: wishlistIds }, isActive: true }).sort({ createdAt: -1 }).lean();
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch wishlist", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/wishlist/{productId}:
 *   post:
 *     summary: Add a product to the wishlist (buyer only — no-op if already present)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Updated wishlist IDs
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.post("/buyer/me/wishlist/:productId", auth("buyer"), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.productId, isActive: true });
    if (!product) return res.status(404).json({ message: "Product not found" });

    await User.updateOne(
      { _id: req.user.id, wishlist: { $ne: req.params.productId } },
      { $push: { wishlist: req.params.productId } }
    );

    const user = await User.findById(req.user.id).select("wishlist").lean();
    return res.status(201).json({ wishlist: user?.wishlist || [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to add wishlist item", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/wishlist/{productId}:
 *   delete:
 *     summary: Remove a product from the wishlist (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated wishlist IDs after removal
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/buyer/me/wishlist/:productId", auth("buyer"), async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $pull: { wishlist: req.params.productId } });
    const user = await User.findById(req.user.id).select("wishlist").lean();
    return res.json({ wishlist: user?.wishlist || [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove wishlist item", error: err.message });
  }
});

/**
 * @swagger
 * /api/users/buyer/me/cart/checkout:
 *   post:
 *     summary: Checkout the entire cart — groups items by seller and creates one order per seller (buyer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: ["Cash on Delivery", "Credit Card"]
 *                 example: "Cash on Delivery"
 *               deliveryAddressId:
 *                 type: string
 *                 description: ID of a saved address (uses default if omitted)
 *               cardDetails:
 *                 type: object
 *                 description: Required when paymentMethod is "Credit Card"
 *                 properties:
 *                   cardNumber: { type: string, example: "4111111111111111" }
 *                   cardHolder: { type: string, example: "John Doe" }
 *                   cardExpiry: { type: string, example: "12/26" }
 *                   cardCVV: { type: string, example: "123" }
 *     responses:
 *       201:
 *         description: Checkout successful — one order created per seller
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Checkout successful" }
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 orderCount: { type: integer, example: 2 }
 *       400:
 *         description: Cart empty, out of stock, or invalid card/address
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/buyer/me/cart/checkout", auth("buyer"), async (req, res) => {
  try {
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    const cardDetails = req.body?.cardDetails || null;
    const deliveryAddressId = req.body?.deliveryAddressId;
    const requestDeliveryAddress = req.body?.deliveryAddress;

    if (paymentMethod === "Credit Card") {
      const cardError = validateCardDetails(cardDetails);
      if (cardError) return res.status(400).json({ message: cardError });
    }

    const user = await User.findById(req.user.id).select("cart addresses");
    if (!user) return res.status(404).json({ message: "Buyer not found" });
    if (!Array.isArray(user.cart) || !user.cart.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const addresses = Array.isArray(user.addresses) ? user.addresses : [];
    if (!addresses.length && !hasAddressDetails(requestDeliveryAddress)) {
      return res.status(400).json({ message: "Please add at least one delivery address before checkout" });
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

    const cartPayload = await buildBuyerCartPayload(req.user.id);
    if (!cartPayload.items.length) {
      user.cart = [];
      await user.save();
      return res.status(400).json({ message: "No valid products found in cart" });
    }

    const groupedBySeller = new Map();
    for (const item of cartPayload.items) {
      const sellerKey = String(item.sellerId);
      const existing = groupedBySeller.get(sellerKey) || [];
      existing.push(item);
      groupedBySeller.set(sellerKey, existing);
    }

    const createdOrders = [];
    for (const [sellerId, items] of groupedBySeller.entries()) {
      const orderItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.unitPrice
      }));

      let totalPrice = 0;
      let expectedDeliveryDays = 1;
      const stockUpdates = [];

      for (const item of items) {
        const stockResult = await Product.updateOne(
          {
            _id: item.productId,
            sellerId,
            isActive: true,
            inventory: { $gte: item.quantity }
          },
          { $inc: { inventory: -item.quantity } }
        );

        if (!stockResult.modifiedCount) {
          if (stockUpdates.length) {
            await Product.bulkWrite(
              stockUpdates.map((u) => ({
                updateOne: {
                  filter: { _id: u.productId },
                  update: { $inc: { inventory: u.quantity } }
                }
              }))
            );
          }
          return res.status(400).json({ message: "One or more items are out of stock" });
        }

        stockUpdates.push({ productId: item.productId, quantity: item.quantity });
        totalPrice += item.unitPrice * item.quantity;
        expectedDeliveryDays = Math.max(expectedDeliveryDays, Number(item.deliveryDays || 1));
      }

      const isCreditCard = paymentMethod === "Credit Card";
      const orderData = {
        buyerId: req.user.id,
        sellerId,
        products: orderItems,
        status: "Placed",
        totalPrice,
        paymentMethod,
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
      createdOrders.push(order);
    }

    user.cart = [];
    await user.save();

    return res.status(201).json({
      message: "Checkout successful",
      orders: createdOrders,
      orderCount: createdOrders.length
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to checkout cart", error: err.message });
  }
});

module.exports = router;