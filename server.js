const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: true }));
app.use(express.json());

const uploadsRoot = path.join(__dirname, "uploads");
const productUploadsDir = path.join(uploadsRoot, "products");
fs.mkdirSync(productUploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsRoot));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || ".jpg";
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const imageUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "marketplace",
  waitForConnections: true,
  connectionLimit: 10
});

async function ensureOptionalTables() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS seller_buyer_ratings (
      id INT NOT NULL AUTO_INCREMENT,
      order_id INT NOT NULL,
      seller_id INT NOT NULL,
      buyer_id INT NOT NULL,
      rating TINYINT NOT NULL,
      comment VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_seller_buyer_rating_order (order_id, seller_id, buyer_id),
      CONSTRAINT chk_seller_buyer_rating CHECK (rating BETWEEN 1 AND 5),
      CONSTRAINT fk_sbr_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_sbr_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
      CONSTRAINT fk_sbr_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
    )`
  );
}

ensureOptionalTables().catch((err) => {
  console.error("Failed to ensure optional tables:", err.message);
});

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && /^[A-Z]/.test(pw);
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function toPublicImageUrl(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("/")) {
    return `http://localhost:${port}${value}`;
  }
  return value;
}

function deleteLocalProductImage(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value) return;

  const publicPrefix = `/uploads/products/`;
  let relativePath = null;

  if (value.startsWith(publicPrefix)) {
    relativePath = value.slice(1);
  } else if (value.includes("/uploads/products/")) {
    const markerIndex = value.indexOf("/uploads/products/");
    relativePath = value.slice(markerIndex + 1);
  }

  if (!relativePath) return;

  const filePath = path.join(__dirname, relativePath.replace(/\\/g, "/"));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, db: "connected" });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Database connection failed", error: err.message });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { role, name, businessName, email, password } = req.body || {};

    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ message: "role must be buyer or seller" });
    }

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: "Password must be at least 8 chars and start with a capital letter" });
    }

    if (role === "seller" && (!businessName || String(businessName).trim().length < 2)) {
      return res.status(400).json({ message: "Business name is required for sellers" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const [buyerExists] = await pool.query("SELECT id FROM buyers WHERE email = ? LIMIT 1", [cleanEmail]);
    const [sellerExists] = await pool.query("SELECT id FROM sellers WHERE email = ? LIMIT 1", [cleanEmail]);
    if (buyerExists.length || sellerExists.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    if (role === "buyer") {
      const [result] = await pool.query(
        "INSERT INTO buyers (full_name, email, password_hash) VALUES (?, ?, ?)",
        [String(name).trim(), cleanEmail, passwordHash]
      );

      return res.status(201).json({
        message: "Buyer account created",
        user: { id: result.insertId, role: "buyer", name: String(name).trim(), email: cleanEmail }
      });
    }

    const [result] = await pool.query(
      "INSERT INTO sellers (business_name, owner_name, email, password_hash) VALUES (?, ?, ?, ?)",
      [String(businessName).trim(), String(name).trim(), cleanEmail, passwordHash]
    );

    return res.status(201).json({
      message: "Seller account created",
      user: {
        id: result.insertId,
        role: "seller",
        name: String(name).trim(),
        businessName: String(businessName).trim(),
        email: cleanEmail
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!validateEmail(email) || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const [buyers] = await pool.query(
      "SELECT id, full_name AS name, email, password_hash FROM buyers WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    const [sellers] = await pool.query(
      "SELECT id, owner_name AS name, business_name AS businessName, email, password_hash FROM sellers WHERE email = ? LIMIT 1",
      [cleanEmail]
    );

    let role = null;
    let account = null;

    if (buyers.length) {
      const ok = await bcrypt.compare(password, buyers[0].password_hash);
      if (ok) {
        role = "buyer";
        account = buyers[0];
      }
    }

    if (!account && sellers.length) {
      const ok = await bcrypt.compare(password, sellers[0].password_hash);
      if (ok) {
        role = "seller";
        account = sellers[0];
      }
    }

    if (!account) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      message: "Login successful",
      user: {
        id: account.id,
        role,
        name: account.name,
        businessName: account.businessName || null,
        email: account.email
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

app.get("/api/catalog", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const category = String(req.query.category || "").trim();

    const filters = ["p.is_active = 1"];
    const params = [];

    if (query) {
      filters.push("(p.title LIKE CONCAT('%', ?, '%') OR c.name LIKE CONCAT('%', ?, '%'))");
      params.push(query, query);
    }

    if (category && category.toLowerCase() !== "all") {
      filters.push("c.name = ?");
      params.push(category);
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.price, p.image_url, p.average_rating, p.stock_quantity,
              p.delivery_estimate_days, c.name AS category, s.business_name, s.id AS seller_id
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE ${filters.join(" AND ")}
       ORDER BY p.created_at DESC`,
      params
    );

    return res.json({
      products: rows.map((r) => ({
        id: r.id,
        name: r.title,
        price: Number(r.price),
        image: toPublicImageUrl(r.image_url),
        avgRating: Number(r.average_rating || 0),
        category: r.category,
        inventory: Number(r.stock_quantity || 0),
        deliveryEstimateDays: Number(r.delivery_estimate_days || 0),
        sellerId: r.seller_id,
        sellerName: r.business_name
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch catalog", error: err.message });
  }
});

app.post("/api/orders", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const buyerId = toNumber(req.body?.buyerId);
    const productId = toNumber(req.body?.productId);
    const quantity = Math.max(1, toNumber(req.body?.quantity, 1));
    const deliveryAddress = String(req.body?.deliveryAddress || "").trim() || null;
    const buyerNote = String(req.body?.buyerNote || "").trim() || null;

    if (!buyerId || !productId) {
      return res.status(400).json({ message: "buyerId and productId are required" });
    }

    const [productRows] = await conn.query(
      "SELECT id, seller_id, price, stock_quantity FROM products WHERE id = ? AND is_active = 1 LIMIT 1",
      [productId]
    );
    if (!productRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];
    if (Number(product.stock_quantity) < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    const unitPrice = Number(product.price);
    const totalAmount = unitPrice * quantity;

    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      "INSERT INTO orders (buyer_id, seller_id, status, total_amount, delivery_address, buyer_note) VALUES (?, ?, 'Placed', ?, ?, ?)",
      [buyerId, product.seller_id, totalAmount, deliveryAddress, buyerNote]
    );

    await conn.query(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
      [orderResult.insertId, productId, quantity, unitPrice]
    );

    await conn.query(
      "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
      [quantity, productId]
    );

    await conn.commit();
    return res.status(201).json({ message: "Order placed", orderId: orderResult.insertId });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ message: "Failed to place order", error: err.message });
  } finally {
    conn.release();
  }
});

app.get("/api/buyer/:buyerId/orders", async (req, res) => {
  try {
    const buyerId = toNumber(req.params.buyerId);
    if (!buyerId) return res.status(400).json({ message: "Invalid buyerId" });

    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total_amount, o.created_at,
              oi.product_id, oi.quantity, oi.unit_price,
              p.title AS product_name, p.image_url,
              s.id AS seller_id, s.business_name AS seller_name,
              COALESCE((
                SELECT oc.comment
                FROM order_comments oc
                WHERE oc.order_id = o.id AND oc.buyer_id = o.buyer_id
                ORDER BY oc.created_at DESC
                LIMIT 1
              ), '') AS comment
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       JOIN sellers s ON s.id = o.seller_id
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [buyerId]
    );

    return res.json({
      orders: rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        productName: r.product_name,
        productPrice: Number(r.unit_price),
        quantity: Number(r.quantity),
        status: r.status,
        comment: r.comment || "",
        createdAt: r.created_at,
        image: toPublicImageUrl(r.image_url),
        totalAmount: Number(r.total_amount || 0),
        sellerId: Number(r.seller_id),
        sellerName: r.seller_name || ""
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch buyer orders", error: err.message });
  }
});

app.post("/api/buyer/orders/:orderId/comment", async (req, res) => {
  try {
    const orderId = toNumber(req.params.orderId);
    const buyerId = toNumber(req.body?.buyerId);
    const comment = String(req.body?.comment || "").trim();
    if (!orderId || !buyerId || !comment) {
      return res.status(400).json({ message: "orderId, buyerId and comment are required" });
    }

    await pool.query(
      "INSERT INTO order_comments (order_id, buyer_id, comment) VALUES (?, ?, ?)",
      [orderId, buyerId, comment]
    );
    return res.json({ message: "Comment saved" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to save comment", error: err.message });
  }
});

app.post("/api/buyer/orders/:orderId/review", async (req, res) => {
  try {
    const orderId = toNumber(req.params.orderId);
    const productId = toNumber(req.body?.productId);
    const buyerId = toNumber(req.body?.buyerId);
    const rating = toNumber(req.body?.rating);
    const reviewComment = String(req.body?.reviewComment || "").trim() || null;

    if (!orderId || !productId || !buyerId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Valid orderId, productId, buyerId and rating (1-5) are required" });
    }

    await pool.query(
      `INSERT INTO product_reviews (order_id, product_id, buyer_id, rating, review_comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), review_comment = VALUES(review_comment)`,
      [orderId, productId, buyerId, rating, reviewComment]
    );

    await pool.query(
      `UPDATE products p
       SET p.average_rating = COALESCE((SELECT AVG(pr.rating) FROM product_reviews pr WHERE pr.product_id = p.id), 0),
           p.review_count = COALESCE((SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = p.id), 0)
       WHERE p.id = ?`,
      [productId]
    );

    return res.json({ message: "Review saved" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to save review", error: err.message });
  }
});

app.delete("/api/buyer/orders/:orderId", async (req, res) => {
  try {
    const orderId = toNumber(req.params.orderId);
    const buyerId = toNumber(req.query.buyerId);
    if (!orderId || !buyerId) return res.status(400).json({ message: "orderId and buyerId are required" });

    const [result] = await pool.query(
      "DELETE FROM orders WHERE id = ? AND buyer_id = ?",
      [orderId, buyerId]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "Order not found" });
    return res.json({ message: "Order removed" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove order", error: err.message });
  }
});

app.post("/api/flags/seller", async (req, res) => {
  try {
    const orderId = toNumber(req.body?.orderId);
    const sellerId = toNumber(req.body?.sellerId);
    const buyerId = toNumber(req.body?.buyerId);
    const reason = String(req.body?.reason || "Other");
    const details = String(req.body?.details || "").trim() || null;

    if (!orderId || !sellerId || !buyerId) {
      return res.status(400).json({ message: "orderId, sellerId and buyerId are required" });
    }

    const [orderRows] = await pool.query(
      "SELECT id, buyer_id, seller_id FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (!orderRows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderRows[0];
    if (Number(order.buyer_id) !== buyerId) {
      return res.status(403).json({ message: "Order does not belong to buyer" });
    }
    if (Number(order.seller_id) !== sellerId) {
      return res.status(400).json({ message: "sellerId does not match order seller" });
    }

    await pool.query(
      "INSERT INTO seller_flags (order_id, seller_id, buyer_id, reason, details) VALUES (?, ?, ?, ?, ?)",
      [orderId, sellerId, buyerId, reason, details]
    );

    await pool.query("UPDATE sellers SET total_flags = total_flags + 1 WHERE id = ?", [sellerId]);
    return res.status(201).json({ message: "Seller flagged" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to flag seller", error: err.message });
  }
});

app.get("/api/seller/:sellerId/profile", async (req, res) => {
  try {
    const sellerId = toNumber(req.params.sellerId);
    if (!sellerId) return res.status(400).json({ message: "Invalid sellerId" });

    const [rows] = await pool.query(
      `SELECT id, owner_name, business_name, email, support_email, phone, address_line, city, country
       FROM sellers
       WHERE id = ? LIMIT 1`,
      [sellerId]
    );

    if (!rows.length) return res.status(404).json({ message: "Seller not found" });
    const s = rows[0];

    return res.json({
      profile: {
        id: s.id,
        ownerName: s.owner_name || "",
        businessName: s.business_name || "",
        email: s.email || "",
        supportEmail: s.support_email || "",
        phone: s.phone || "",
        addressLine: s.address_line || "",
        city: s.city || "",
        country: s.country || ""
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller profile", error: err.message });
  }
});

app.patch("/api/seller/:sellerId/profile", async (req, res) => {
  try {
    const sellerId = toNumber(req.params.sellerId);
    if (!sellerId) return res.status(400).json({ message: "Invalid sellerId" });

    const ownerName = String(req.body?.ownerName || "").trim();
    const businessName = String(req.body?.businessName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const supportEmail = String(req.body?.supportEmail || "").trim().toLowerCase() || null;
    const phone = String(req.body?.phone || "").trim() || null;
    const addressLine = String(req.body?.addressLine || "").trim() || null;
    const city = String(req.body?.city || "").trim() || null;
    const country = String(req.body?.country || "").trim() || null;

    if (!ownerName || !businessName || !validateEmail(email)) {
      return res.status(400).json({ message: "Valid ownerName, businessName and email are required" });
    }
    if (supportEmail && !validateEmail(supportEmail)) {
      return res.status(400).json({ message: "supportEmail must be a valid email" });
    }

    const [existingSeller] = await pool.query(
      "SELECT id FROM sellers WHERE email = ? AND id <> ? LIMIT 1",
      [email, sellerId]
    );
    const [existingBuyer] = await pool.query(
      "SELECT id FROM buyers WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingSeller.length || existingBuyer.length) {
      return res.status(409).json({ message: "Email already used by another account" });
    }

    const [result] = await pool.query(
      `UPDATE sellers
       SET owner_name = ?, business_name = ?, email = ?, support_email = ?,
           phone = ?, address_line = ?, city = ?, country = ?
       WHERE id = ?`,
      [ownerName, businessName, email, supportEmail, phone, addressLine, city, country, sellerId]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "Seller not found" });

    return res.json({ message: "Seller profile updated" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update seller profile", error: err.message });
  }
});

app.get("/api/seller/:sellerId/products", async (req, res) => {
  try {
    const sellerId = toNumber(req.params.sellerId);
    if (!sellerId) return res.status(400).json({ message: "Invalid sellerId" });

    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.price, p.average_rating, p.image_url, p.stock_quantity,
              p.delivery_estimate_days, c.name AS category,
              COALESCE(SUM(oi.quantity), 0) AS order_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       WHERE p.seller_id = ?
       GROUP BY p.id, p.title, p.price, p.average_rating, p.image_url, p.stock_quantity, p.delivery_estimate_days, c.name
       ORDER BY p.created_at DESC`,
      [sellerId]
    );

    return res.json({
      products: rows.map((r) => ({
        id: r.id,
        name: r.title,
        price: Number(r.price),
        rating: Number(r.average_rating || 0),
        image: toPublicImageUrl(r.image_url),
        category: r.category,
        deliveryEstimateDays: Number(r.delivery_estimate_days || 0),
        inventory: Number(r.stock_quantity || 0),
        orders: Number(r.order_count || 0)
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller products", error: err.message });
  }
});

app.post("/api/seller/products", imageUpload.single("image"), async (req, res) => {
  try {
    const sellerId = toNumber(req.body?.sellerId);
    const title = String(req.body?.name || "").trim();
    const categoryIdInput = toNumber(req.body?.categoryId);
    const categoryNameInput = String(req.body?.category || "").trim();
    const price = toNumber(req.body?.price);
    const inventory = Math.max(0, toNumber(req.body?.inventory, 0));
    const deliveryEstimateDays = Math.max(1, toNumber(req.body?.deliveryEstimateDays, 1));
    const imageUrl = req.file
      ? `/uploads/products/${req.file.filename}`
      : String(req.body?.image || "").trim() || null;
    const description = String(req.body?.description || "").trim() || null;

    if (!sellerId || !title || !price || (!categoryIdInput && !categoryNameInput)) {
      return res.status(400).json({ message: "sellerId, name, price and category/categoryId are required" });
    }

    let categoryId = null;
    if (categoryIdInput) {
      const [existingById] = await pool.query("SELECT id FROM categories WHERE id = ? LIMIT 1", [categoryIdInput]);
      if (!existingById.length) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }
      categoryId = existingById[0].id;
    } else {
      const [categories] = await pool.query("SELECT id FROM categories WHERE name = ? LIMIT 1", [categoryNameInput]);
      if (categories.length) {
        categoryId = categories[0].id;
      } else {
        const [insertCategory] = await pool.query(
          "INSERT INTO categories (name, description) VALUES (?, ?)",
          [categoryNameInput, `${categoryNameInput} products`]
        );
        categoryId = insertCategory.insertId;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO products
        (seller_id, category_id, title, description, image_url, price, stock_quantity, delivery_estimate_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sellerId, categoryId, title, description, imageUrl, price, inventory, deliveryEstimateDays]
    );

    return res.status(201).json({ message: "Product created", productId: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});

app.get("/api/seller/:sellerId/orders", async (req, res) => {
  try {
    const sellerId = toNumber(req.params.sellerId);
    if (!sellerId) return res.status(400).json({ message: "Invalid sellerId" });

    const [rows] = await pool.query(
      `SELECT o.id, o.buyer_id, b.full_name AS buyer_name, o.status,
              o.total_amount, o.created_at,
              p.title AS product_name,
              sbr.rating AS buyer_rating,
              sbr.comment AS buyer_rating_comment
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN seller_buyer_ratings sbr
         ON sbr.order_id = o.id AND sbr.seller_id = o.seller_id AND sbr.buyer_id = o.buyer_id
       WHERE o.seller_id = ?
       ORDER BY o.created_at DESC`,
      [sellerId]
    );

    return res.json({
      orders: rows.map((r) => ({
        id: r.id,
        buyer_id: r.buyer_id,
        buyerId: r.buyer_id,
        buyer_name: r.buyer_name,
        buyer: r.buyer_name,
        product: r.product_name,
        status: r.status,
        total_amount: Number(r.total_amount || 0),
        created_at: r.created_at,
        buyer_rating: r.buyer_rating ? Number(r.buyer_rating) : null,
        buyer_rating_comment: r.buyer_rating_comment || null
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch seller orders", error: err.message });
  }
});

app.patch("/api/seller/orders/:orderId/status", async (req, res) => {
  try {
    const orderId = toNumber(req.params.orderId);
    const sellerId = toNumber(req.body?.sellerId);
    const status = String(req.body?.status || "").trim();

    if (!orderId || !sellerId || !status) {
      return res.status(400).json({ message: "orderId, sellerId and status are required" });
    }

    const [result] = await pool.query(
      "UPDATE orders SET status = ? WHERE id = ? AND seller_id = ?",
      [status, orderId, sellerId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Order not found" });
    return res.json({ message: "Order status updated" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  }
});

app.post("/api/seller/flags/buyer", async (req, res) => {
  try {
    const orderId = toNumber(req.body?.orderId);
    const buyerId = toNumber(req.body?.buyerId);
    const sellerId = toNumber(req.body?.sellerId);
    const reason = String(req.body?.reason || "Other");
    const details = String(req.body?.details || "").trim() || null;

    if (!orderId || !buyerId || !sellerId) {
      return res.status(400).json({ message: "orderId, buyerId and sellerId are required" });
    }

    await pool.query(
      "INSERT INTO buyer_flags (order_id, buyer_id, seller_id, reason, details) VALUES (?, ?, ?, ?, ?)",
      [orderId, buyerId, sellerId, reason, details]
    );

    return res.status(201).json({ message: "Buyer flagged" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to flag buyer", error: err.message });
  }
});

app.post("/api/seller/ratings/buyer", async (req, res) => {
  try {
    const orderId = toNumber(req.body?.orderId);
    const buyerId = toNumber(req.body?.buyerId);
    const sellerId = toNumber(req.body?.sellerId);
    const rating = toNumber(req.body?.rating);
    const comment = String(req.body?.comment || "").trim() || null;

    if (!orderId || !buyerId || !sellerId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "orderId, buyerId, sellerId and rating (1-5) are required" });
    }

    const [orderRows] = await pool.query(
      "SELECT id FROM orders WHERE id = ? AND seller_id = ? AND buyer_id = ? LIMIT 1",
      [orderId, sellerId, buyerId]
    );
    if (!orderRows.length) {
      return res.status(404).json({ message: "Order not found for this seller/buyer" });
    }

    await pool.query(
      `INSERT INTO seller_buyer_ratings (order_id, seller_id, buyer_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [orderId, sellerId, buyerId, rating, comment]
    );

    return res.status(201).json({ message: "Buyer rated successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to rate buyer", error: err.message });
  }
});

// ========== New Seller Product Management Endpoints ==========

app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, description FROM categories ORDER BY name");
    return res.json({
      categories: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || ""
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

app.get("/api/seller/products/:productId", async (req, res) => {
  try {
    const productId = toNumber(req.params.productId);
    if (!productId) return res.status(400).json({ message: "Invalid productId" });

    const [rows] = await pool.query(
      `SELECT p.id, p.seller_id, p.title, p.description, p.image_url, p.price, 
              p.discount_percentage, p.stock_quantity, p.delivery_estimate_days,
              p.average_rating, p.review_count, p.is_active, p.created_at, p.updated_at,
              c.id AS category_id, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? LIMIT 1`,
      [productId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const p = rows[0];
    return res.json({
      product: {
        id: p.id,
        sellerId: p.seller_id,
        name: p.title,
        description: p.description || "",
        image: toPublicImageUrl(p.image_url),
        price: Number(p.price),
        discountPercentage: Number(p.discount_percentage || 0),
        quantity: Number(p.stock_quantity),
        deliveryEstimateDays: Number(p.delivery_estimate_days),
        rating: Number(p.average_rating || 0),
        reviewCount: Number(p.review_count || 0),
        isActive: p.is_active,
        categoryId: p.category_id,
        categoryName: p.category_name,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch product details", error: err.message });
  }
});

app.put("/api/seller/products/:productId", imageUpload.single("image"), async (req, res) => {
  try {
    const productId = toNumber(req.params.productId);
    const sellerId = toNumber(req.body?.sellerId);
    const title = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim() || null;
    const price = toNumber(req.body?.price);
    const discountPercentage = Math.max(0, Math.min(100, toNumber(req.body?.discountPercentage, 0)));
    const quantity = Math.max(0, toNumber(req.body?.quantity, 0));
    const deliveryEstimateDays = Math.max(1, toNumber(req.body?.deliveryEstimateDays, 1));
    const categoryIdInput = toNumber(req.body?.categoryId);
    const categoryNameInput = String(req.body?.category || "").trim();
    const newImageUrl = req.file
      ? `/uploads/products/${req.file.filename}`
      : String(req.body?.image || "").trim() || null;
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : null;

    if (!productId || !sellerId) {
      return res.status(400).json({ message: "productId and sellerId are required" });
    }

    // Verify seller owns this product
    const [productCheck] = await pool.query(
      "SELECT seller_id, image_url FROM products WHERE id = ? LIMIT 1",
      [productId]
    );
    if (!productCheck.length) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (productCheck[0].seller_id !== sellerId) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    let categoryId = null;
    if (categoryIdInput) {
      const [existingById] = await pool.query("SELECT id FROM categories WHERE id = ? LIMIT 1", [categoryIdInput]);
      if (!existingById.length) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }
      categoryId = existingById[0].id;
    } else if (categoryNameInput) {
      const [existingByName] = await pool.query("SELECT id FROM categories WHERE name = ? LIMIT 1", [categoryNameInput]);
      if (existingByName.length) {
        categoryId = existingByName[0].id;
      } else {
        const [insertCategory] = await pool.query(
          "INSERT INTO categories (name, description) VALUES (?, ?)",
          [categoryNameInput, `${categoryNameInput} products`]
        );
        categoryId = insertCategory.insertId;
      }
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (price) {
      updates.push("price = ?");
      params.push(price);
    }
    if (discountPercentage >= 0) {
      updates.push("discount_percentage = ?");
      params.push(discountPercentage);
    }
    if (quantity >= 0) {
      updates.push("stock_quantity = ?");
      params.push(quantity);
    }
    if (deliveryEstimateDays >= 1) {
      updates.push("delivery_estimate_days = ?");
      params.push(deliveryEstimateDays);
    }
    if (categoryId) {
      updates.push("category_id = ?");
      params.push(categoryId);
    }
    if (isActive !== null) {
      updates.push("is_active = ?");
      params.push(isActive);
    }
    if (req.file) {
      updates.push("image_url = ?");
      params.push(newImageUrl);
    } else if (req.body?.image !== undefined) {
      updates.push("image_url = ?");
      params.push(newImageUrl);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    if (!updates.length || updates.length === 1) {
      return res.status(400).json({ message: "No updates provided" });
    }

    params.push(productId);

    const [result] = await pool.query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (!result.affectedRows) {
      return res.status(500).json({ message: "Failed to update product" });
    }

    if (req.file && productCheck[0].image_url && productCheck[0].image_url !== newImageUrl) {
      deleteLocalProductImage(productCheck[0].image_url);
    }

    return res.json({ message: "Product updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update product", error: err.message });
  }
});

app.delete("/api/seller/products/:productId", async (req, res) => {
  try {
    const productId = toNumber(req.params.productId);
    const sellerId = toNumber(req.body?.sellerId ?? req.query?.sellerId);

    if (!productId || !sellerId) {
      return res.status(400).json({ message: "productId and sellerId are required" });
    }

    const [productRows] = await pool.query(
      "SELECT id, seller_id, image_url FROM products WHERE id = ? LIMIT 1",
      [productId]
    );
    if (!productRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (productRows[0].seller_id !== sellerId) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    const [orderItemRows] = await pool.query(
      "SELECT id FROM order_items WHERE product_id = ? LIMIT 1",
      [productId]
    );
    if (orderItemRows.length) {
      return res.status(409).json({ message: "This product has existing orders and cannot be deleted" });
    }

    const [result] = await pool.query("DELETE FROM products WHERE id = ? AND seller_id = ?", [productId, sellerId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (productRows[0].image_url) {
      deleteLocalProductImage(productRows[0].image_url);
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete product", error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Auth API listening on http://localhost:${port}`);
});
