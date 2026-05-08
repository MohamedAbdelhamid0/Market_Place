# Marketplace Platform

A full-stack e-commerce marketplace application with separate buyer and seller interfaces. Built with React, Node.js, and MongoDB, the platform enables buyers to browse and purchase products while sellers manage inventory, fulfill orders, and interact with customers.

## Project Overview

This is a two-sided marketplace where:
- **Buyers** can search, filter, and purchase products from multiple sellers
- **Sellers** can manage their product inventory and order fulfillment
- Both sides have complete authentication and real-time interaction

## Live Deployment

The application was successfully deployed and tested on AWS:
- **Buyer Portal**: `http://16.170.182.71:8080/`
- **Seller Portal**: `http://16.170.182.71:8081/`

**Current Status**: Both instances are currently turned off to reduce infrastructure costs. The deployment confirmed all features work correctly in production.

## Features

### Buyer Application
- **Product Discovery** - Search, filter by category, price range, and seller ratings
- **Shopping Cart** - Add/remove items, adjust quantities, persistent cart management
- **Checkout** - Multiple payment methods (Cash on Delivery, Credit Card)
- **Order Management** - View orders, track status, cancel orders, view delivery estimates
- **Ratings & Reviews** - Rate sellers and products, write reviews with AI-powered summaries
- **Wishlist** - Save products for future purchase
- **Profile Management** - Update profile, manage multiple delivery addresses
- **Reporting System** - Report sellers for late delivery or other issues with tracking

### Seller Application
- **Product Management** - Add, edit, update products with inventory tracking
- **Dashboard** - Sales overview, earnings, and seller rating statistics
- **Order Fulfillment** - View and update order status through complete workflow
- **Customer Ratings** - Track and view buyer ratings and feedback
- **Profile Management** - Update business information and contact details

## Tech Stack

**Backend:**
- Node.js + Express.js
- MongoDB (data persistence)
- JWT (authentication & authorization)
- Multer (image uploads)

**Frontend:**
- React 18 (via Vite)
- Vanilla CSS (custom styling)
- React Router (client-side navigation)

**Infrastructure:**
- Docker & Docker Compose
- AWS EC2 (deployment)
- Nginx (reverse proxy)

## Project Structure

```
Market_Place/
├── backend/                  # Express.js server
│   ├── src/
│   │   ├── server.js
│   │   ├── middleware/       # Authentication middleware
│   │   ├── models/           # MongoDB schemas
│   │   └── routes/           # API endpoints
│   └── uploads/              # Product images
├── buyer-app/                # Buyer React application
│   ├── src/
│   │   ├── api.js            # API client
│   │   ├── App.jsx           # Main component
│   │   └── styles.css
│   └── Dockerfile
├── seller-app/               # Seller React application
│   ├── src/
│   │   ├── api.js            # API client
│   │   ├── App.jsx           # Main component
│   │   └── pages/            # Page components
│   └── Dockerfile
└── docker-compose.yml
```

## Local Development Setup

### Prerequisites
- Node.js (v16+)
- MongoDB
- Docker & Docker Compose (optional)

### Installation

1. **Install all dependencies:**
```bash
npm run install:all
```

2. **Configure MongoDB:**
```bash
docker run -d -p 27017:27017 --name marketplace-mongo mongo
```

3. **Setup environment variables:**

Create `backend/.env`:
```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/market_place
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

4. **Run all services:**

Open 3 terminals and run:

```bash
# Terminal 1 - Backend (runs on :4000)
npm run dev:backend

# Terminal 2 - Buyer App (runs on :5173)
npm run dev:buyer

# Terminal 3 - Seller App (runs on :5174)
npm run dev:seller
```

The marketplace will be available at:
- Backend API: `http://localhost:4000`
- Buyer App: `http://localhost:5173`
- Seller App: `http://localhost:5174`

## API Overview

### Core Endpoints
- **Authentication** - `/api/auth/register`, `/api/auth/login`
- **Products** - `/api/products`, `/api/products/:id`
- **Orders** - `/api/orders`, `/api/orders/buyer/me`, `/api/orders/buyer/:orderId/cancel`
- **Cart** - `/api/users/buyer/me/cart`, `/api/users/buyer/me/cart/items`
- **Ratings** - `/api/orders/buyer/ratings/seller`, `/api/comments`
- **Wishlist** - `/api/users/buyer/me/wishlist`
- **Reporting** - `/api/flags`, `/api/flags/buyer/my-flags`

## Testing the Application

### Buyer Workflow
1. Register as buyer or login
2. Browse products with search and filters
3. View product details and reviews
4. Add items to cart or wishlist
5. Proceed to checkout with delivery address and payment method
6. View orders and rate sellers post-delivery

### Seller Workflow
1. Register as seller or login
2. Add products with descriptions and pricing
3. Upload product images
4. View incoming orders
5. Update order status as fulfillment progresses
6. Monitor sales analytics

## Key Implementation Details

- **Authentication** - JWT tokens stored in sessionStorage with automatic logout
- **Error Handling** - Comprehensive error messages and user feedback via toast notifications
- **State Management** - React hooks (useState, useCallback, useMemo) for efficient updates
- **Optimistic Updates** - Cart and wishlist operations update UI immediately for better UX
- **Responsive Design** - Functional on desktop, tablet, and mobile devices

## Production Deployment

The application was containerized and deployed to AWS using:
- Docker containers for both frontend applications
- Nginx for reverse proxy and load balancing
- Environment-specific configuration files

Run with Docker Compose:
```bash
docker-compose -f docker-compose.frontends.yml up
```

## Contributors

Developed as part of an Internet Programming course project. 
