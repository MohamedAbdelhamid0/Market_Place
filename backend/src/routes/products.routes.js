const express = require("express");
const Product = require("../models/Product");
const Comment = require("../models/Comment");
const Order = require("../models/Order");
const { auth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    return cb(null, true);
  }
});

function maybeUpload(req, res, next) {
  const type = req.headers["content-type"] || "";
  if (type.includes("multipart/form-data")) {
    return imageUpload.single("image")(req, res, next);
  }
  return next();
}

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product catalog management
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List all active products (with optional search & category filter)
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword matched against product name (case-insensitive)
 *         example: headphones
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by exact category name
 *         example: Electronics
 *     responses:
 *       200:
 *         description: Array of active products enriched with seller info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Internal server error
 */
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (q) filter.name = { $regex: q, $options: "i" };

    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    const sellerIds = [...new Set(products.map((product) => String(product.sellerId)))];
    const sellers = sellerIds.length ? await require("../models/User").find({ _id: { $in: sellerIds } }).select("name businessName email supportEmail phone city country").lean() : [];
    const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));

    return res.json(
      products.map((product) => {
        const seller = sellerMap.get(String(product.sellerId));
        return {
          ...product,
          sellerName: seller?.name || "Seller",
          sellerBusinessName: seller?.businessName || "",
          sellerEmail: seller?.email || "",
          sellerSupportEmail: seller?.supportEmail || "",
          sellerPhone: seller?.phone || "",
          sellerCity: seller?.city || "",
          sellerCountry: seller?.country || ""
        };
      })
    );
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Get all distinct product categories
 *     tags: [Products]
 *     security: []
 *     responses:
 *       200:
 *         description: Sorted list of category objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: Electronics
 *       500:
 *         description: Internal server error
 */
router.get("/categories", async (_req, res) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    return res.json(
      categories
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((name, i) => ({ id: i + 1, name }))
    );
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

/**
 * @swagger
 * /api/products/seller/me/list:
 *   get:
 *     summary: Get the authenticated seller's products with sales count (seller only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller's products enriched with sold quantity from delivered orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Product'
 *                   - type: object
 *                     properties:
 *                       orders:
 *                         type: integer
 *                         description: Total units sold (delivered orders)
 *                         example: 12
 *       401:
 *         description: Unauthorized — token missing or invalid
 *       403:
 *         description: Forbidden — user is not a seller
 *       500:
 *         description: Internal server error
 */
router.get("/seller/me/list", auth("seller"), async (req, res) => {
  try {
    const [products, sellerOrders] = await Promise.all([
      Product.find({ sellerId: req.user.id }).sort({ createdAt: -1 }).lean(),
      Order.find({ sellerId: req.user.id, status: "Delivered" }).select("products").lean()
    ]);

    const soldByProduct = new Map();
    for (const order of sellerOrders) {
      for (const item of order.products || []) {
        const key = String(item.productId);
        soldByProduct.set(key, (soldByProduct.get(key) || 0) + Number(item.quantity || 0));
      }
    }

    const normalized = products.map((product) => {
      const soldFromOrders = soldByProduct.get(String(product._id)) || 0;

      return {
        ...product,
        orders: soldFromOrders
      };
    });

    return res.json(normalized);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller products", error: err.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get a single product by ID with seller info and recent comments
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product MongoDB ObjectId
 *         example: 64a1f2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Product details with seller info and last 20 comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    const User = require("../models/User");
    const seller = await User.findById(product.sellerId).select("name businessName email supportEmail phone city country").lean();
    const comments = await Comment.find({ productId: product._id }).sort({ createdAt: -1 }).limit(20).lean();
    return res.json({
      product: {
        ...product,
        sellerName: seller?.name || "Seller",
        sellerBusinessName: seller?.businessName || "",
        sellerEmail: seller?.email || "",
        sellerSupportEmail: seller?.supportEmail || "",
        sellerPhone: seller?.phone || "",
        sellerCity: seller?.city || "",
        sellerCountry: seller?.country || ""
      },
      comments
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch product", error: err.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product (seller only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Wireless Headphones
 *               description:
 *                 type: string
 *                 example: Noise-cancelling over-ear headphones
 *               price:
 *                 type: number
 *                 example: 99.99
 *               category:
 *                 type: string
 *                 example: Electronics
 *               deliveryDays:
 *                 type: integer
 *                 example: 3
 *               discountPercentage:
 *                 type: number
 *                 example: 10
 *               inventory:
 *                 type: integer
 *                 example: 50
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Product image file (max 5MB, images only)
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error (missing name/price, invalid price)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — user is not a seller
 *       500:
 *         description: Internal server error
 */
router.post("/", auth("seller"), maybeUpload, async (req, res) => {
  try {
    const { name, description, price, category, deliveryDays, deliveryTime, imageUrl, discountPercentage, inventory } = req.body || {};
    if (!name || price === undefined || price === null || price === "") {
      return res.status(400).json({ message: "name and price are required" });
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "price must be a valid positive number" });
    }

    const parsedDeliveryDays = Math.max(
      1,
      Number(deliveryDays ?? String(deliveryTime || "").match(/\d+/)?.[0] ?? 3)
    );

    const uploadedImageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description || "").trim(),
      price: parsedPrice,
      category: String(category || "General").trim(),
      deliveryDays: parsedDeliveryDays,
      discountPercentage: Math.max(0, Math.min(100, Number(discountPercentage || 0))),
      inventory: Math.max(0, Number(inventory || 0)),
      imageUrl: uploadedImageUrl || String(imageUrl || "").trim(),
      sellerId: req.user.id
    });

    return res.status(201).json(product);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product (seller only, must own the product)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product MongoDB ObjectId
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               deliveryDays:
 *                 type: integer
 *               discountPercentage:
 *                 type: number
 *               inventory:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated product object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found or not owned by this seller
 *       500:
 *         description: Internal server error
 */
router.put("/:id", auth("seller"), maybeUpload, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const uploadedImageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const fields = [
      "name",
      "description",
      "price",
      "category",
      "deliveryDays",
      "imageUrl",
      "discountPercentage",
      "inventory",
      "isActive"
    ];

    if (req.body.deliveryTime !== undefined && req.body.deliveryDays === undefined) {
      req.body.deliveryDays = Number(String(req.body.deliveryTime || "").match(/\d+/)?.[0] || 3);
    }

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (["price", "discountPercentage", "inventory", "deliveryDays"].includes(field)) {
          product[field] = Number(req.body[field]);
        } else {
          product[field] = req.body[field];
        }
      }
    }

    if (uploadedImageUrl) {
      product.imageUrl = uploadedImageUrl;
    }

    await product.save();
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update product", error: err.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product (seller only — blocked if active orders exist)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product deleted
 *       400:
 *         description: Product cannot be deleted — active orders (Placed/Processing/Preparing) exist
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found or not owned by this seller
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", auth("seller"), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.id }).select("_id");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const blockingOrder = await Order.findOne({
      sellerId: req.user.id,
      "products.productId": product._id,
      status: { $in: ["Placed", "Processing", "Preparing"] }
    }).select("_id status");

    if (blockingOrder) {
      return res.status(400).json({
        message: "Product cannot be deleted until all related orders are shipped"
      });
    }

    const result = await Product.deleteOne({ _id: req.params.id, sellerId: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ message: "Product not found" });
    return res.json({ message: "Product deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete product", error: err.message });
  }
});

module.exports = router;
