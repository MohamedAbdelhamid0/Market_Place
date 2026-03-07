-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE products (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          title VARCHAR(200) NOT NULL,
                          price DECIMAL(10,2),
                          image VARCHAR(255),
                          category VARCHAR(100),
                          rating FLOAT DEFAULT 0,
                          inventory INT DEFAULT 0,
                          sold_products INT DEFAULT 0,
                          store_id INT,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                          FOREIGN KEY (store_id) REFERENCES store(store_owner)
);


-- =========================
-- SELLERS
-- =========================
CREATE TABLE seller (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100),
                        email VARCHAR(100) UNIQUE,
                        support_email VARCHAR(100) UNIQUE,
                        password VARCHAR(255),
                        location VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================
-- STORES
-- =========================
CREATE TABLE store (
                       store_owner INT PRIMARY KEY,
                       store_owner_name VARCHAR(100),
                       name VARCHAR(100),
                       bio TEXT,
                       location VARCHAR(255),
                       rating FLOAT DEFAULT 0,
                       amount_sold INT DEFAULT 0,
                       available_inventory INT DEFAULT 0,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                       FOREIGN KEY (store_owner) REFERENCES seller(id),
                       FOREIGN KEY (store_owner_name) REFERENCES seller(name),
                       FOREIGN KEY (amount_sold) REFERENCES products (sold_products),
                       FOREIGN KEY (available_inventory) REFERENCES products (inventory)
);

CREATE VIEW store_stats AS
SELECT
    s.store_owner,
    s.name AS store_name,
    SUM(p.inventory) AS sum_available_inventory,
    SUM(p.sold_products) AS sum_amount_sold
FROM store s
         LEFT JOIN products p ON s.store_owner = p.store_id
GROUP BY s.store_owner, s.name;

-- =========================
-- BUYERS
-- =========================
CREATE TABLE buyer (
                       id INT AUTO_INCREMENT PRIMARY KEY,
                       name VARCHAR(100),
                       email VARCHAR(100) UNIQUE,
                       password VARCHAR(255),
                       location VARCHAR(255),
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================
-- ORDERS
-- =========================
CREATE TABLE orders (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        product_id INT,
                        buyer_id INT,
                        status VARCHAR(50) DEFAULT 'Pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                        FOREIGN KEY (product_id) REFERENCES products(id),
                        FOREIGN KEY (buyer_id) REFERENCES buyer(id)
);


-- =========================
-- ADDITIONS FOR BUYER APP (app-screens.js)
-- =========================
-- These tables/columns support: order comments, product ratings, search, and order flow

-- =========================
-- ORDER REVIEWS (Submit Comment + Rate flow)
-- =========================
-- Stores buyer comments and 1-5 ratings submitted via "Submit Comment" button on order cards
CREATE TABLE order_reviews (
                               id INT AUTO_INCREMENT PRIMARY KEY,
                               order_id INT NOT NULL,
                               buyer_id INT NOT NULL,
                               rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                               comment TEXT,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                               FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                               FOREIGN KEY (buyer_id) REFERENCES buyer(id) ON DELETE CASCADE,
                               UNIQUE KEY unique_review_per_order (order_id)
);

-- =========================
-- ORDER COMMENTS (alternative: add to orders if 1:1)
-- =========================
-- Optional: add comment column directly to orders if you prefer denormalization
-- ALTER TABLE orders ADD COLUMN buyer_comment TEXT;
-- ALTER TABLE orders ADD COLUMN buyer_rating TINYINT CHECK (buyer_rating >= 1 AND buyer_rating <= 5);

-- =========================
-- PRODUCT SEARCH INDEX
-- =========================
-- Speeds up product search by title (used when filtering product cards)
CREATE INDEX idx_products_title ON products(title);
CREATE INDEX idx_products_category ON products(category);

-- =========================
-- ORDERS LOOKUP INDEXES
-- =========================
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- =========================
-- PRODUCT RATING AGGREGATE (optional trigger)
-- =========================
-- Keep products.rating in sync with order_reviews (via orders -> product_id)
-- Run periodically or use a trigger
/*
CREATE TRIGGER update_product_rating AFTER INSERT ON order_reviews
FOR EACH ROW
BEGIN
  UPDATE products p
  SET p.rating = (
    SELECT AVG(r.rating) FROM order_reviews r
    JOIN orders o ON r.order_id = o.id
    WHERE o.product_id = p.id
  )
  WHERE p.id = (SELECT product_id FROM orders WHERE id = NEW.order_id);
END;
*/

-- =========================
-- SAMPLE QUERIES FOR APP INTEGRATION
-- =========================

-- Get orders for a buyer (with product title, status) - for My Orders screen
/*
SELECT o.id, o.status, o.created_at, p.title, p.price, p.image
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE o.buyer_id = ?
ORDER BY o.created_at DESC;
*/

-- Insert new order (place order flow)
/*
INSERT INTO orders (product_id, buyer_id, status) VALUES (?, ?, 'Processing');
*/

-- Insert order review (Submit Comment + rate flow)
/*
INSERT INTO order_reviews (order_id, buyer_id, rating, comment)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment);
*/

-- Get products for home/search (product cards)
/*
SELECT id, title, price, image, category, rating
FROM products
WHERE title LIKE CONCAT('%', ?, '%')
ORDER BY rating DESC;
*/
