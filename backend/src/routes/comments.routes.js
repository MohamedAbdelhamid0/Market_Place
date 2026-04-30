const express = require("express");
const Comment = require("../models/Comment");
const Product = require("../models/Product");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/", auth(), async (req, res) => {
  try {
    const { productId, text, rating } = req.body || {};
    if (!productId || !text || !rating) {
      return res.status(400).json({ message: "productId, text, rating are required" });
    }

    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const existing = await Comment.findOne({ productId, userId: req.user.id });
    if (existing) {
      if (Number(existing.rating) === normalizedRating) {
        return res.status(409).json({ message: "You already reviewed this product with the same rating" });
      }

      existing.text = String(text).trim();
      existing.rating = normalizedRating;
      await existing.save();

      const stats = await Comment.aggregate([
        { $match: { productId: existing.productId } },
        {
          $group: {
            _id: "$productId",
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 }
          }
        }
      ]);

      if (stats.length) {
        await Product.updateOne(
          { _id: existing.productId },
          {
            $set: {
              ratings: Number(stats[0].averageRating || 0),
              reviewCount: Number(stats[0].reviewCount || 0)
            }
          }
        );
      }

      return res.json(existing);
    }

    const comment = await Comment.create({
      productId,
      userId: req.user.id,
      text: String(text).trim(),
      rating: normalizedRating
    });

    const stats = await Comment.aggregate([
      { $match: { productId: comment.productId } },
      {
        $group: {
          _id: "$productId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    if (stats.length) {
      await Product.updateOne(
        { _id: comment.productId },
        {
          $set: {
            ratings: Number(stats[0].averageRating || 0),
            reviewCount: Number(stats[0].reviewCount || 0)
          }
        }
      );
    }

    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add comment", error: err.message });
  }
});

router.get("/product/:productId", async (req, res) => {
  try {
    const comments = await Comment.find({ productId: req.params.productId }).sort({ createdAt: -1 });
    return res.json(comments);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch comments", error: err.message });
  }
});

router.get("/product/:productId/summarize", async (req, res) => {
  try {
    const comments = await Comment.find({ productId: req.params.productId }).sort({ createdAt: -1 });

    if (!comments.length) {
      return res.json({ summary: "No comments yet.", sampleSize: 0 });
    }

    const ratings = comments.map((c) => Number(c.rating || 0));
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    const positives = comments.filter((c) => /good|great|excellent|fast|love|perfect/i.test(c.text)).length;
    const negatives = comments.filter((c) => /bad|slow|poor|broken|late|problem/i.test(c.text)).length;

    const tone = positives >= negatives ? "mostly positive" : "mixed to negative";
    const summary = `Based on ${comments.length} comments, average rating is ${avg.toFixed(1)}/5 with a ${tone} sentiment.`;

    return res.json({ summary, sampleSize: comments.length, averageRating: Number(avg.toFixed(1)) });
  } catch (err) {
    return res.status(500).json({ message: "Failed to summarize comments", error: err.message });
  }
});

module.exports = router;
