-- Seller.sql
-- Seller-side SQL objects and ready-to-use queries for marketplace
-- Run Buyer.sql first.

USE marketplace;

-- =========================
-- VIEWS
-- =========================

-- Product inventory + sales summary per seller
CREATE OR REPLACE VIEW v_seller_product_stats AS
SELECT
    s.id AS seller_id,
    s.business_name,
    p.id AS product_id,
    p.title,
    c.name AS category,
    p.stock_quantity,
    p.delivery_estimate_days,
    p.price,
    COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
    COALESCE(SUM(oi.subtotal), 0) AS total_revenue
FROM sellers s
JOIN products p ON p.seller_id = s.id
JOIN categories c ON c.id = p.category_id
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
    AND o.status IN ('Delivered', 'Shipping', 'Preparing', 'Processing', 'Placed')
GROUP BY s.id, s.business_name, p.id, p.title, c.name, p.stock_quantity, p.delivery_estimate_days, p.price;

-- Seller order inbox
CREATE OR REPLACE VIEW v_seller_orders AS
SELECT
    o.id AS order_id,
    o.seller_id,
    s.business_name,
    o.buyer_id,
    b.full_name AS buyer_name,
    o.status,
    o.total_amount,
    o.delivery_address,
    o.created_at,
    o.updated_at
FROM orders o
JOIN sellers s ON s.id = o.seller_id
JOIN buyers b ON b.id = o.buyer_id;

-- =========================
-- STORED PROCEDURES
-- =========================

-- Seller updates status of an order they own
DROP PROCEDURE IF EXISTS sp_seller_update_order_status;
CREATE PROCEDURE sp_seller_update_order_status(
    IN p_seller_id INT,
    IN p_order_id INT,
    IN p_new_status VARCHAR(20)
)
UPDATE orders
SET status = p_new_status
WHERE id = p_order_id
  AND seller_id = p_seller_id
  AND p_new_status IN ('Processing', 'Preparing', 'Shipping', 'Delivered', 'Cancelled');

-- Seller flags buyer
DROP PROCEDURE IF EXISTS sp_seller_flag_buyer;
CREATE PROCEDURE sp_seller_flag_buyer(
    IN p_order_id INT,
    IN p_buyer_id INT,
    IN p_seller_id INT,
    IN p_reason VARCHAR(30),
    IN p_details TEXT
)
INSERT INTO buyer_flags (order_id, buyer_id, seller_id, reason, details)
VALUES (p_order_id, p_buyer_id, p_seller_id, p_reason, p_details);

-- =========================
-- SELLER QUERIES
-- =========================

-- 1) List orders received by a seller
-- SELECT order_id, buyer_name, status, total_amount, created_at
-- FROM v_seller_orders
-- WHERE seller_id = ?
-- ORDER BY created_at DESC;

-- 2) Change order status
-- CALL sp_seller_update_order_status(?, ?, 'Shipping');

-- 3) Add new product listing
-- INSERT INTO products (seller_id, category_id, title, description, image_url, price, stock_quantity, delivery_estimate_days)
-- VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- 4) See product stats
-- SELECT *
-- FROM v_seller_product_stats
-- WHERE seller_id = ?
-- ORDER BY total_revenue DESC;

-- 5) Flag buyer
-- CALL sp_seller_flag_buyer(?, ?, ?, 'RefusedPackage', 'Buyer refused to receive package on arrival.');
