CREATE TABLE users (
                       id INT AUTO_INCREMENT PRIMARY KEY,
                       name VARCHAR(100),
                       email VARCHAR(100) UNIQUE,
                       password VARCHAR(255),
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          title VARCHAR(200) NOT NULL,
                          image VARCHAR(255),
                          rating FLOAT DEFAULT 0,
                          price DECIMAL(10,2) NOT NULL DEFAULT 0,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        product_id INT,
                        status VARCHAR(50) DEFAULT 'Processing',
                        quantity INT DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =========================
-- Sum per product calculation
-- =========================
SELECT
    p.id AS product_id,
    p.title,
    p.price,
    SUM(o.quantity) AS total_quantity_bought,
    SUM(o.quantity * p.price) AS total_spent
FROM products p
         JOIN orders o ON p.id = o.product_id
WHERE o.status = 'Completed'
GROUP BY p.id, p.title, p.price;

-- =========================
-- Total Sum of Order calculation
-- =========================


SELECT
    SUM(o.quantity * p.price) AS grand_total_spent
FROM products p
         JOIN orders o ON p.id = o.product_id
WHERE o.status = 'Completed';


-- =========================
-- REVIEWS TABLE
-- =========================
CREATE TABLE reviews (
                         id INT AUTO_INCREMENT PRIMARY KEY,
                         user_id INT,
                         product_id INT,
                         order_id INT,
                         rating INT CHECK (rating >= 1 AND rating <= 5),
                         comment TEXT,
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                         FOREIGN KEY (user_id) REFERENCES users(id),
                         FOREIGN KEY (product_id) REFERENCES products(id),
                         FOREIGN KEY (order_id) REFERENCES orders(id)
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
                       name VARCHAR(100),
                       bio TEXT,
                       location VARCHAR(255),
                       rating FLOAT DEFAULT 0,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                       FOREIGN KEY (store_owner) REFERENCES seller(id)
);


-- =========================
-- SAMPLE PRODUCTS
-- =========================
INSERT INTO products (title, image, rating) VALUES
                                                ('Wireless Headphones','images/headphones.jpg',4.5),
                                                ('Smart Watch','images/watch.jpg',4.2),
                                                ('Gaming Mouse','images/mouse.jpg',4.6),
                                                ('Mechanical Keyboard','images/keyboard.jpg',4.8),
                                                ('Bluetooth Speaker','images/speaker.jpg',4.3);