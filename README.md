# Market Place

A lightweight, front-end-only marketplace web application with separate interfaces for **Buyers** and **Sellers**, backed by a MySQL-compatible SQL schema.

## Project Overview

The project consists of two standalone HTML applications (no build step required) and a database schema for backend integration.

| File | Description |
|---|---|
| `Buyer.html` | Buyer-facing catalog, orders, profile & report screens |
| `buyer2.js` | Buyer app logic (navigation, place order, search, rating) |
| `seller.html` | Seller dashboard (products, add item, orders, profile) |
| `app.js` | Seller app logic (product rendering, search, order status) |
| `Seller.sql` | Full seller-side database schema |
| `Buyer.sql` | Buyer-side database schema with sample queries |

---

## Features

### Buyer App (`Buyer.html`)

- **Catalog / Home** — browse product cards with images, title, price, star rating, category filter chips, and live search
- **My Orders** — view current orders with delivery status badges; submit a comment / rating per order
- **Place Order** — select a product from the catalog and place an order (appended live to the Orders screen)
- **Buyer Profile** — personal stats (total orders, total spent, saved items), quick-action shortcuts (Track, Wishlist, Addresses, Payment), and a verified-buyer badge
- **Report Seller** — fill in a seller name and reason to submit a report

### Seller App (`seller.html`)

- **Dashboard** — hero section with store metrics (revenue, total orders, inventory), product grid with search, and a quick-stats side panel
- **Add Item** — form to add a new product (name, price, rating, category); the new card is immediately rendered in the product grid
- **Orders** — tabular order list with status badges (Paid / Pending / Refunded) and filter pills
- **Profile / Settings** — seller avatar, editable store details, and notification toggle switches

---

## File Structure

```
Market_Place/
├── Buyer.html        # Buyer web app
├── buyer2.js         # Buyer app JavaScript
├── seller.html       # Seller dashboard web app
├── app.js            # Seller app JavaScript
├── Buyer.sql         # Buyer-side SQL schema & sample queries
├── Seller.sql        # Seller-side SQL schema, views & indexes
├── headphones.jpg    # Product image
├── smartWatch.jpg    # Product image
├── lens.jpg          # Product image
├── laptopbag.jpg     # Product image
└── sneakers.jpg      # Product image
```

---

## Database Schema

### Seller.sql

| Table | Purpose |
|---|---|
| `seller` | Seller accounts |
| `store` | Store profiles linked to a seller |
| `products` | Product listings (title, price, category, inventory, sold count) |
| `buyer` | Buyer accounts |
| `orders` | Purchase orders linking buyers and products |
| `order_reviews` | Buyer comments and 1-5 star ratings per order |

Also includes:
- `store_stats` — a view that aggregates total inventory and total sold per store
- Indexes on `products(title)`, `products(category)`, `orders(buyer_id)`, `orders(status)`, `orders(created_at)`

### Buyer.sql

| Table | Purpose |
|---|---|
| `users` | User accounts |
| `products` | Product catalog |
| `orders` | Order records |
| `reviews` | Product reviews |
| `seller` | Seller accounts |
| `store` | Store profiles |

Also includes sample aggregate queries (sum per product, grand total spent).

---

## Getting Started

No build tools or dependencies are required.

1. Clone or download the repository.
2. Open **`Buyer.html`** in a browser to use the buyer app.
3. Open **`seller.html`** in a browser to use the seller dashboard.

> Product images (`headphones.jpg`, `smartWatch.jpg`, `lens.jpg`, `laptopbag.jpg`, `sneakers.jpg`) must be in the same directory as the HTML files.

---

## Tech Stack

- **HTML5 / CSS3** — fully self-contained styles (no external CSS framework)
- **Vanilla JavaScript** — no frameworks or dependencies
- **MySQL** — SQL schema files ready for backend integration
