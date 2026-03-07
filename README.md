# Market Place

A simple web-based marketplace application with separate **Buyer** and **Seller** interfaces, backed by a SQL database schema.

## Project Overview

Market Place is a front-end prototype for an online marketplace. It consists of two standalone HTML apps — one for buyers browsing and ordering products, and one for sellers managing their listings, orders, and store profile. All UI is built with plain HTML, CSS, and vanilla JavaScript; no frameworks or build tools are required.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Database schema:** MySQL-compatible SQL

## Project Structure

```
Market_Place/
├── Buyer.html       # Buyer-facing web app
├── buyer2.js        # JavaScript for the buyer app (navigation, ordering, rating, search)
├── seller.html      # Seller-facing web app
├── app.js           # JavaScript for the seller app (products, orders, search)
├── Buyer.sql        # Database schema for the buyer side (users, products, orders, reviews, seller, store)
├── Seller.sql       # Extended database schema for the seller side (products, sellers, stores, buyers, orders, reviews, indexes)
├── headphones.jpg   # Product image
├── laptopbag.jpg    # Product image
├── lens.jpg         # Product image
├── smartWatch.jpg   # Product image
└── sneakers.jpg     # Product image
```

## Features

### Buyer App (`Buyer.html` + `buyer2.js`)

| Screen | Description |
|--------|-------------|
| **Home / Catalog** | Browse products in a 2-column grid, search by name, and filter by category (Electronics, Clothes, Home, Sports, Books). Tap a product card to view details, place an order, or rate an item. |
| **My Orders** | View active orders with their current delivery status (Delivered / Shipping). Leave a comment and rating for each completed order. |
| **Buyer Profile** | Dashboard showing total orders, amount spent, and saved items. Quick-action links for Track Order, Wishlist, Addresses, and Payment. Displays verified-buyer badge. |
| **Report Seller** | Submit a report against a seller by entering their name and a description of the issue. |

### Seller App (`seller.html` + `app.js`)

| Screen | Description |
|--------|-------------|
| **Dashboard** | Overview of today's revenue, open orders, store rating, fulfillment health, and upcoming payouts. Product grid with live search. |
| **Add Product** | Form to create a new listing with name, category, price, stock quantity, rating, image URL, tags, and description. |
| **Orders** | List of buyer orders with status filters (All / Paid / Pending / Refunded) and per-order status management (Pending → Preparing → Delivered) and buyer flagging. |
| **Seller Profile** | Editable store profile (name, email, support email, bio, location). |

### Database (`Buyer.sql` / `Seller.sql`)

- **Tables:** `users`, `products`, `orders`, `reviews`, `order_reviews`, `seller`, `store`, `buyer`
- **Indexes** on product title/category and order buyer/status/date for fast search and lookups
- **Views:** `store_stats` – aggregates inventory and sales per store
- **Sample data** and ready-to-use query templates for the app integration

## Getting Started

No build step or server is required for the front-end. Just open the HTML files directly in a browser:

```bash
# Open the buyer app
open Buyer.html

# Open the seller app
open seller.html
```

For the database, run the SQL files against a MySQL-compatible server:

```bash
# Using the mysql CLI
mysql -u your_username -p your_database < Buyer.sql
mysql -u your_username -p your_database < Seller.sql
```

Or from within a MySQL session:

```sql
SOURCE Buyer.sql;
SOURCE Seller.sql;
```
