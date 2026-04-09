-- Migration: Add discount_percentage column to products table
-- Run this script to update existing database installations
-- Compatible with MySQL 5.7+

USE marketplace;

-- Add discount_percentage column to products table
ALTER TABLE products 
ADD COLUMN discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- Update the view to include discount information
DROP VIEW IF EXISTS v_seller_product_stats;

CREATE VIEW v_seller_product_stats AS
SELECT
    s.id AS seller_id,
    s.business_name,
    p.id AS product_id,
    p.title,
    c.name AS category,
    p.price,
    p.discount_percentage,
    p.stock_quantity,
    p.delivery_estimate_days,
    COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
    COALESCE(SUM(oi.subtotal), 0) AS total_revenue
FROM sellers s
JOIN products p ON p.seller_id = s.id
JOIN categories c ON c.id = p.category_id
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
    AND o.status IN ('Delivered', 'Shipping', 'Preparing', 'Processing', 'Placed')
GROUP BY s.id, s.business_name, p.id, p.title, c.name, p.price, p.discount_percentage, 
         p.stock_quantity, p.delivery_estimate_days;

-- Confirmation
SELECT 'Migration completed successfully! The discount_percentage column is ready.' AS status;
