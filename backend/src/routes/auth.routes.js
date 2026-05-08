const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validateEmail, validatePassword } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User registration and login
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (buyer or seller)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegisterInput'
 *               - type: object
 *                 properties:
 *                   businessName:
 *                     type: string
 *                     description: Required only when role is "seller"
 *                     example: "John's Electronics"
 *           examples:
 *             buyer:
 *               summary: Register as buyer
 *               value: { name: "Jane Doe", email: "jane@example.com", password: "Secret123!", role: "buyer" }
 *             seller:
 *               summary: Register as seller
 *               value: { name: "John Doe", email: "john@example.com", password: "Secret123!", role: "seller", businessName: "John's Electronics" }
 *     responses:
 *       201:
 *         description: User registered successfully — returns JWT token and user info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error (missing fields, invalid email or weak password)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, businessName } = req.body || {};

    if (!name || !email || !password || !["buyer", "seller"].includes(role)) {
      return res.status(400).json({ message: "name, email, password, role are required" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password requirements
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ message: passwordErrors.join(", "), errors: passwordErrors });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hash,
      role,
      businessName: role === "seller" ? String(businessName || "").trim() : ""
    });

    const token = createToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        flags: user.flags,
        businessName: user.businessName,
        supportEmail: user.supportEmail,
        phone: user.phone,
        addressLine: user.addressLine,
        city: user.city,
        country: user.country
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Register failed", error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *           example:
 *             email: "john@example.com"
 *             password: "Secret123!"
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token and user info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing or invalid email/password fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const authUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!authUser) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, authUser.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = createToken(authUser);
    return res.json({
      token,
      user: {
        id: authUser._id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        flags: authUser.flags || 0,
        businessName: authUser.businessName || "",
        supportEmail: authUser.supportEmail || "",
        phone: authUser.phone || "",
        addressLine: authUser.addressLine || "",
        city: authUser.city || "",
        country: authUser.country || ""
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

module.exports = router;
