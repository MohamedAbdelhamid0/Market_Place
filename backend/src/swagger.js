const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Marketplace API",
      version: "1.0.0",
      description:
        "REST API documentation for the Marketplace platform. Supports buyer and seller workflows including auth, products, orders, cart, wishlist, ratings, comments, and flags.",
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token (obtained from /api/auth/login)",
        },
      },
      schemas: {
        // ─── Auth ────────────────────────────────────────────────────────────
        RegisterInput: {
          type: "object",
          required: ["name", "email", "password", "role"],
          properties: {
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "Secret123!" },
            role: { type: "string", enum: ["buyer", "seller"], example: "buyer" },
          },
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "Secret123!" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            user: {
              type: "object",
              properties: {
                id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
                name: { type: "string", example: "John Doe" },
                email: { type: "string", example: "john@example.com" },
                role: { type: "string", example: "buyer" },
              },
            },
          },
        },

        // ─── Product ─────────────────────────────────────────────────────────
        Product: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "Wireless Headphones" },
            description: { type: "string", example: "High quality noise-cancelling headphones" },
            price: { type: "number", example: 99.99 },
            stock: { type: "integer", example: 50 },
            category: { type: "string", example: "Electronics" },
            imageUrl: { type: "string", example: "/uploads/products/headphones.jpg" },
            seller: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d2" },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ProductInput: {
          type: "object",
          required: ["name", "price", "stock", "category"],
          properties: {
            name: { type: "string", example: "Wireless Headphones" },
            description: { type: "string", example: "High quality noise-cancelling headphones" },
            price: { type: "number", example: 99.99 },
            stock: { type: "integer", example: 50 },
            category: { type: "string", example: "Electronics" },
          },
        },

        // ─── Order ───────────────────────────────────────────────────────────
        Order: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d3" },
            buyer: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
            seller: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d2" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d4" },
                  quantity: { type: "integer", example: 2 },
                  price: { type: "number", example: 99.99 },
                },
              },
            },
            totalAmount: { type: "number", example: 199.98 },
            status: {
              type: "string",
              enum: ["placed", "processing", "preparing", "shipping", "delivered", "cancelled"],
              example: "placed",
            },
            paymentMethod: { type: "string", enum: ["cash", "credit_card"], example: "cash" },
            deliveryAddress: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                country: { type: "string" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        OrderInput: {
          type: "object",
          required: ["items", "paymentMethod", "deliveryAddress"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d4" },
                  quantity: { type: "integer", example: 2 },
                },
              },
            },
            paymentMethod: { type: "string", enum: ["cash", "credit_card"], example: "cash" },
            deliveryAddress: {
              type: "object",
              properties: {
                street: { type: "string", example: "123 Main St" },
                city: { type: "string", example: "Cairo" },
                country: { type: "string", example: "Egypt" },
              },
            },
          },
        },

        // ─── Comment ─────────────────────────────────────────────────────────
        Comment: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d5" },
            product: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d4" },
            buyer: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
            rating: { type: "integer", minimum: 1, maximum: 5, example: 4 },
            text: { type: "string", example: "Great product, fast delivery!" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Flag ────────────────────────────────────────────────────────────
        Flag: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d6" },
            order: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d3" },
            filedBy: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
            against: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d2" },
            reason: {
              type: "string",
              enum: ["late_delivery", "package_not_received"],
              example: "late_delivery",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Cart ────────────────────────────────────────────────────────────
        CartItem: {
          type: "object",
          properties: {
            product: { $ref: "#/components/schemas/Product" },
            quantity: { type: "integer", example: 2 },
          },
        },

        // ─── Address ─────────────────────────────────────────────────────────
        Address: {
          type: "object",
          required: ["street", "city", "country"],
          properties: {
            _id: { type: "string" },
            street: { type: "string", example: "123 Main St" },
            city: { type: "string", example: "Cairo" },
            country: { type: "string", example: "Egypt" },
          },
        },

        // ─── Error ───────────────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: {
            message: { type: "string", example: "Unauthorized" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.routes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
