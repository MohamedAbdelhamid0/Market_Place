-- Buyer.sql
-- Core Marketplace schema (buyer + seller + ordering + ratings + flagging)
-- MySQL 8+

CREATE DATABASE IF NOT EXISTS marketplace;
USE marketplace;

SET NAMES utf8mb4;

-- =========================
-- USERS (buyers and sellers)
-- =========================
CREATE TABLE IF NOT EXISTS buyers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(25),
    address_line VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sellers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(120) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    support_email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(25),
    address_line VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_flags INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bonus requirement: seller can define serviceability area
CREATE TABLE IF NOT EXISTS seller_service_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    area_name VARCHAR(120) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    UNIQUE KEY uq_seller_area (seller_id, area_name),
    CONSTRAINT fk_service_area_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

-- =========================
-- CATALOG
-- =========================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    delivery_estimate_days INT NOT NULL,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    review_count INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_seller FOREIGN KEY (seller_id) REFERENCES sellers(id),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_products_title ON products(title);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_seller_id ON products(seller_id);

-- =========================
-- ORDERS
-- =========================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    status ENUM('Placed', 'Processing', 'Preparing', 'Shipping', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Placed',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    delivery_address VARCHAR(255),
    buyer_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id),
    CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) AS (quantity * unit_price) STORED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Buyer comments on orders
CREATE TABLE IF NOT EXISTS order_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    buyer_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_comments_order_id ON order_comments(order_id);

-- =========================
-- RATINGS / REVIEWS
-- =========================
CREATE TABLE IF NOT EXISTS product_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    buyer_id INT NOT NULL,
    rating TINYINT NOT NULL,
    review_comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_product_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_review_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id),
    UNIQUE KEY uq_review_per_order_product_buyer (order_id, product_id, buyer_id)
);

CREATE INDEX idx_reviews_product_id ON product_reviews(product_id);

-- =========================
-- FLAGGING SYSTEM
-- =========================
-- Buyer flags seller (for delays/no delivery)
CREATE TABLE IF NOT EXISTS seller_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    reason ENUM('DelayedDelivery', 'NoDelivery', 'DamagedItem', 'Other') NOT NULL,
    details TEXT,
    status ENUM('Open', 'Reviewed', 'Resolved') NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_seller_flag_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_seller_flag_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_seller_flag_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
);

CREATE INDEX idx_seller_flags_seller_id ON seller_flags(seller_id);

-- Seller flags buyer (for refusal/non-receipt)
CREATE TABLE IF NOT EXISTS buyer_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    reason ENUM('RefusedPackage', 'Unreachable', 'FakeAddress', 'Other') NOT NULL,
    details TEXT,
    status ENUM('Open', 'Reviewed', 'Resolved') NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buyer_flag_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_buyer_flag_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE,
    CONSTRAINT fk_buyer_flag_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

CREATE INDEX idx_buyer_flags_buyer_id ON buyer_flags(buyer_id);

-- =========================
-- SAMPLE CATEGORIES
-- =========================
INSERT INTO categories (name, description)
VALUES
    ('Electronics', 'Electronic products and gadgets'),
    ('Fashion', 'Clothes, shoes, and accessories'),
    ('Home', 'Home and living products'),
    ('Sports', 'Sports and fitness equipment')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- =========================
-- HELPFUL BUYER QUERIES
-- =========================
-- 1) Catalog with seller + category
-- SELECT p.id, p.title, p.price, p.delivery_estimate_days, c.name AS category, s.business_name AS seller
-- FROM products p
-- JOIN categories c ON c.id = p.category_id
-- JOIN sellers s ON s.id = p.seller_id
-- WHERE p.is_active = 1
-- ORDER BY p.created_at DESC;

-- 2) Search by product title
-- SELECT id, title, price, average_rating
-- FROM products
-- WHERE title LIKE CONCAT('%', ?, '%') AND is_active = 1;

-- 3) Buyer order tracking
-- SELECT o.id, o.status, o.total_amount, o.created_at, s.business_name
-- FROM orders o
-- JOIN sellers s ON s.id = o.seller_id
-- WHERE o.buyer_id = ?
-- ORDER BY o.created_at DESC;
