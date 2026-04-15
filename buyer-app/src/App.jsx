import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, getToken, getUser, saveAuth, logout } from "./api";

const OFFERS = [
  { title: "Summer Sale", text: "Up to 40% off trending picks", cta: "Shop deals", bg: "linear-gradient(135deg, #2563eb, #4f46e5)" },
  { title: "Free Delivery", text: "Selected items ship free today", cta: "Browse offers", bg: "linear-gradient(135deg, #0f766e, #14b8a6)" },
  { title: "New Arrivals", text: "Fresh products added this week", cta: "See new items", bg: "linear-gradient(135deg, #7c3aed, #ec4899)" }
];

const emptyOrderForm = { productId: "", quantity: 1, comment: "" };

function money(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(0)}`;
}

function stars(rating) {
  const value = Math.max(0, Math.min(5, Math.round((Number(rating) || 0) * 2) / 2));
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return "★".repeat(full) + (half ? "⯨" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
}

function formatDeliveryEstimate(product) {
  const numericDays = Number(product?.deliveryDays);
  if (Number.isFinite(numericDays) && numericDays > 0) {
    return `${numericDays} day${numericDays === 1 ? "" : "s"}`;
  }

  const legacyMatch = String(product?.deliveryTime || "").match(/\d+/);
  if (legacyMatch) {
    const days = Number(legacyMatch[0]);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return "3 days";
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const payload = mode === "register"
        ? { name: form.name, email: form.email, password: form.password, role: "buyer" }
        : { email: form.email, password: form.password };

      const result = mode === "register" ? await api.register(payload) : await api.login(payload);
      saveAuth(result.token, result.user);
      onAuthed(result.user);
    } catch (err) {
      setError(err.message || "Authentication failed");
    }
  }

  return (
    <main className="auth-wrapper">
      <section className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">{mode === "login" ? "🔐" : "✨"}</div>
        </div>
        <h1 className="auth-title">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p className="auth-subtitle">{mode === "login" ? "Sign in to your account" : "Join us today — it&apos;s free"}</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === "register" ? (
            <div className="form-group">
              <label className="form-label" htmlFor="buyer-name">Full Name</label>
              <input
                id="buyer-name"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Jane Doe"
                required
              />
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label" htmlFor="buyer-email">Email</label>
            <input
              id="buyer-email"
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="buyer-password">Password</label>
            <input
              id="buyer-password"
              type="password"
              className="form-input"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button type="button" className="link-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}

function BuyerAppShell() {
  const user = getUser();
  const [screen, setScreen] = useState("home");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");
  const [orderFilter, setOrderFilter] = useState("All");
  const [ratings, setRatings] = useState({});
  const [refreshOrders, setRefreshOrders] = useState(0);
  const [reportForm, setReportForm] = useState({ orderId: "", sellerId: "", reason: "" });
  const [heroCarouselIndex, setHeroCarouselIndex] = useState(0);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);

  useEffect(() => {
    api.products().then((list) => {
      const normalized = (list || []).map((product) => ({
        id: product._id,
        name: product.name,
        category: product.category || "General",
        price: Number(product.price || 0),
        image: product.imageUrl || "",
        avgRating: Number(product.ratings || 0),
        deliveryEstimateDays: formatDeliveryEstimate(product),
        sellerId: product.sellerId,
        sellerName: product.sellerName || "Seller",
        inventory: Number(product.inventory || 0)
      }));
      setProducts(normalized);
      setCategories(["All", ...Array.from(new Set(normalized.map((p) => p.category).filter(Boolean)))].sort());
      if (!selectedId && normalized[0]) setSelectedId(normalized[0].id);
    }).catch((err) => alert(err.message));
  }, [selectedId]);

  useEffect(() => {
    if (!user?.id) return;
    api.buyerOrders().then((list) => setOrders(Array.isArray(list) ? list : [])).catch((err) => alert(err.message));
  }, [user?.id, refreshOrders]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroCarouselIndex((current) => (current + 1) % OFFERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !q || product.name.toLowerCase().includes(q) || (product.category || "").toLowerCase().includes(q);
      const matchesCategory = category === "All" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);

  const selectedProduct = products.find((product) => product.id === selectedId) || filteredProducts[0] || null;

  const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
  const deliveredCount = orders.filter((order) => order.status === "Delivered").length;
  const recentOrders = orders.slice(0, 5);

  async function placeOrder(product) {
    await api.placeOrder([{ productId: product.id, quantity: 1 }]);
    setRefreshOrders((value) => value + 1);
    setScreen("orders");
  }

  async function submitReview(order, rating) {
    await api.addComment({
      productId: order.products?.[0]?.productId,
      text: order.comment || "",
      rating
    });
    setRefreshOrders((value) => value + 1);
  }

  async function flagSeller() {
    if (!reportForm.orderId || !reportForm.reason.trim()) {
      alert("Select an order and provide a reason.");
      return;
    }

    const matchingOrder = orders.find((order) => String(order._id) === String(reportForm.orderId));
    if (!matchingOrder) {
      alert("Select a valid order.");
      return;
    }

    await apiSendLikeOld("/flags/seller", {
      orderId: matchingOrder._id,
      sellerId: matchingOrder.sellerId,
      buyerId: user.id,
      reason: "Other",
      details: reportForm.reason
    });

    setReportForm({ orderId: "", sellerId: "", reason: "" });
    alert("Seller report submitted successfully.");
  }

  async function apiSendLikeOld(path, payload) {
    const token = getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  if (!user) return <Navigate to="/" replace />;

  if (screen === "home" && view === "details" && selectedProduct) {
    return (
      <>
        <div className="screen active" id="home">
          <div className="product-details">
            <button type="button" className="btn" style={{ width: "auto", padding: "10px 14px", background: "#e5e7eb", marginTop: 0, marginBottom: 14 }} onClick={() => setView("list")}>← Back</button>
            <div className="header" style={{ marginBottom: 12, color: "var(--text)" }}>{selectedProduct.name}</div>
            <img src={selectedProduct.image || ""} alt={selectedProduct.name} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 14, marginBottom: 14 }} />
            <p style={{ color: "var(--text-muted)" }}>Category: <strong style={{ color: "var(--text)" }}>{selectedProduct.category}</strong></p>
            <p style={{ marginTop: 6 }}><strong>{money(selectedProduct.price)}</strong></p>
            <p style={{ marginTop: 6 }}>Product rating: <span className="stars">{stars(selectedProduct.avgRating)}</span></p>
            <p style={{ marginTop: 6, color: "var(--text-muted)" }}>Delivery estimate: {selectedProduct.deliveryEstimateDays}</p>
            <button className="btn order-btn" type="button" onClick={() => placeOrder(selectedProduct)}>Place Order</button>
          </div>
        </div>
        <nav className="nav">
          <a href="#" className="nav__item active" data-screen="home" onClick={(e) => { e.preventDefault(); setScreen("home"); setView("list"); }}>🏠 Home</a>
          <a href="#" className="nav__item" data-screen="orders" onClick={(e) => { e.preventDefault(); setScreen("orders"); setView("list"); }}>📦 Orders</a>
          <a href="#" className="nav__item" data-screen="buyer" onClick={(e) => { e.preventDefault(); setScreen("buyer"); setView("list"); }}>👤 Buyer</a>
          <a href="#" className="nav__item" data-screen="report" onClick={(e) => { e.preventDefault(); setScreen("report"); setView("list"); }}>⚠️ Report</a>
        </nav>
      </>
    );
  }

  return (
    <>
      <div className={`screen ${screen === "home" ? "active" : ""}`} id="home">
        {screen === "home" ? (
          <div>
            <div className="buyer-hero">
              <div className="buyer-hero__greeting">Welcome back</div>
              <div className="buyer-hero__name">{user.name || "Buyer"}</div>
            </div>

            <section className="carousel" aria-label="Offers carousel">
              <div className="carousel-track" style={{ transform: `translateX(-${heroCarouselIndex * 100}%)` }}>
                {OFFERS.map((offer, index) => (
                  <article className="carousel-slide" key={offer.title}>
                    <div className="carousel-copy">
                      <span className="product-badge">Offer {index + 1}</span>
                      <h3>{offer.title}</h3>
                      <p>{offer.text}</p>
                      <div className="carousel-cta">{offer.cta} →</div>
                    </div>
                    <div className="carousel-visual" style={{ background: offer.bg }} />
                  </article>
                ))}
              </div>
              <div className="carousel-dots">
                {OFFERS.map((offer, index) => (
                  <button key={offer.title} type="button" className={`carousel-dot ${index === heroCarouselIndex ? "active" : ""}`} onClick={() => setHeroCarouselIndex(index)} aria-label={`Go to offer ${index + 1}`} />
                ))}
              </div>
            </section>

            <div className="buyer-stats">
              <div className="stat-card"><div className="stat-card__value">{orders.length}</div><div className="stat-card__label">Orders</div></div>
              <div className="stat-card"><div className="stat-card__value">{money(totalSpent)}</div><div className="stat-card__label">Total spent</div></div>
              <div className="stat-card"><div className="stat-card__value">{deliveredCount}</div><div className="stat-card__label">Delivered</div></div>
            </div>

            <div className="header">Marketplace</div>
            <input className="search-bar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." aria-label="Search products" />

            <div className="categories" role="tablist" aria-label="Categories">
              {categories.map((item) => (
                <button key={item} type="button" className="category" onClick={() => setCategory(item)} style={{ border: "none", outline: "none", background: item === category ? "#eaf0ff" : "white" }} aria-pressed={item === category}>{item}</button>
              ))}
            </div>

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <div key={product.id} className="product-card" onClick={() => { setSelectedId(product.id); setView("details"); }} role="button" tabIndex={0} onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedId(product.id);
                    setView("details");
                  }
                }}>
                  <div className="product-badge">{product.category}</div>
                  <img className="product-img" src={product.image || ""} alt={product.name} />
                  <div className="product-title">{product.name}</div>
                  <div className="product-rating">
                    <span className="stars">{stars(product.avgRating)}</span>
                    <span className="rating-value">({Number(product.avgRating || 0).toFixed(1)})</span>
                  </div>
                  <div className="product-price">{money(product.price)}</div>
                </div>
              ))}
            </div>

            {!filteredProducts.length ? <div className="product-details" style={{ marginTop: 16 }}>No products match your search.</div> : null}
          </div>
        ) : null}
      </div>

      <div className={`screen ${screen === "orders" ? "active" : ""}`} id="orders">
        {screen === "orders" ? (
          <div>
            <h1 className="header">My Orders</h1>
            <div className="categories" aria-label="Order filters">
              {[
                "All",
                "Placed",
                "Processing",
                "Preparing",
                "Shipping",
                "Delivered",
                "Cancelled"
              ].map((item) => (
                <button key={item} type="button" className="category" onClick={() => setOrderFilter(item)} style={{ border: "none", outline: "none", background: item === orderFilter ? "#eaf0ff" : "white" }}>{item}</button>
              ))}
            </div>

            {orders.filter((order) => orderFilter === "All" || order.status === orderFilter).map((order) => (
              <article key={order._id} className="order-card">
                <h2 className="order-card__title">{order.productName || `Order ${String(order._id).slice(-6)}`}</h2>
                <div className={`order-status ${order.status === "Delivered" ? "order-status--delivered" : order.status === "Shipping" ? "order-status--shipping" : "order-status--processing"}`}>{order.status}</div>
                <div className="comment-section">
                  <textarea
                    className="comment-box"
                    placeholder="Add a comment or review for this order…"
                    rows={3}
                    value={order.comment || ""}
                    onChange={(e) => setOrders((prev) => prev.map((item) => item._id === order._id ? { ...item, comment: e.target.value } : item))}
                  />
                  <button type="button" className="rate-btn" onClick={async () => {
                    try {
                      await api.addComment({ productId: order.products?.[0]?.productId, text: order.comment || "", rating: 5 });
                      alert("Comment saved");
                    } catch (err) {
                      alert(err.message || "Failed to save comment");
                    }
                  }}>Submit Comment</button>
                  <button type="button" className="btn" style={{ background: "#ef4444", color: "white" }} onClick={async () => {
                    try {
                      const token = getToken();
                      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/orders/buyer/me`, {
                        method: "DELETE",
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                      });
                      if (!response.ok) throw new Error("Failed to remove order");
                      setRefreshOrders((value) => value + 1);
                    } catch (err) {
                      alert(err.message);
                    }
                  }}>Remove Order</button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`screen ${screen === "buyer" ? "active" : ""}`} id="buyer">
        {screen === "buyer" ? (
          <div>
            <div className="buyer-hero">
              <div className="buyer-hero__greeting">Welcome back</div>
              <div className="buyer-hero__name" id="buyer-profile-name">{user.name || "Buyer"}</div>
            </div>
            <div className="buyer-stats">
              <div className="stat-card"><div className="stat-card__value">{orders.length}</div><div className="stat-card__label">Orders</div></div>
              <div className="stat-card"><div className="stat-card__value">{money(totalSpent)}</div><div className="stat-card__label">Spent</div></div>
              <div className="stat-card"><div className="stat-card__value">5</div><div className="stat-card__label">Saved</div></div>
            </div>
            <div className="buyer-section">
              <h2 className="buyer-section__title">Quick actions</h2>
              <div className="quick-actions">
                <a href="#" className="quick-action"><span className="quick-action__icon">🔍</span><span>Track order</span></a>
                <a href="#" className="quick-action"><span className="quick-action__icon">❤️</span><span>Wishlist</span></a>
                <a href="#" className="quick-action"><span className="quick-action__icon">📍</span><span>Addresses</span></a>
                <a href="#" className="quick-action"><span className="quick-action__icon">💳</span><span>Payment</span></a>
              </div>
            </div>
            <div className="trust-badge">
              <div className="trust-badge__icon">✓</div>
              <div className="trust-badge__text">
                <strong>Verified buyer</strong>
                <span>Your account is in good standing</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`screen ${screen === "report" ? "active" : ""}`} id="report">
        {screen === "report" ? (
          <div>
            <h1 className="header">Report Seller</h1>
            <div className="report-box">
              <div className="form-group">
                <label htmlFor="report-order">Order</label>
                <select id="report-order" className="search-bar" aria-label="Select order to report" value={reportForm.orderId} onChange={(e) => setReportForm((prev) => ({ ...prev, orderId: e.target.value }))}>
                  <option value="">Select an order</option>
                  {orders.filter((order) => order.status !== "Cancelled").map((order) => (
                    <option key={order._id} value={order._id}>#{String(order._id).slice(-6)} - {order.productName || order.product || "Product"} ({order.status})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="report-seller">Seller</label>
                <input type="text" id="report-seller" className="search-bar" placeholder="Select an order first" readOnly value={(() => {
                  const match = orders.find((order) => String(order._id) === String(reportForm.orderId));
                  return match ? `${match.sellerName || "Seller"} (ID: ${match.sellerId})` : "";
                })()} />
              </div>
              <div className="form-group">
                <label htmlFor="report-reason">Reason</label>
                <textarea id="report-reason" placeholder="Describe the issue (e.g. item not as described, late delivery, poor communication)…" rows={4} value={reportForm.reason} onChange={(e) => setReportForm((prev) => ({ ...prev, reason: e.target.value }))} />
              </div>
              <button type="button" className="btn order-btn" onClick={flagSeller}>Submit report</button>
              <p className="report-notice">Reports are reviewed within 24–48 hours. We may contact you for more details.</p>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="nav">
        <a href="#" className={`nav__item ${screen === "home" ? "active" : ""}`} data-screen="home" onClick={(e) => { e.preventDefault(); setScreen("home"); setView("list"); }}>🏠 Home</a>
        <a href="#" className={`nav__item ${screen === "orders" ? "active" : ""}`} data-screen="orders" onClick={(e) => { e.preventDefault(); setScreen("orders"); setView("list"); }}>📦 Orders</a>
        <a href="#" className={`nav__item ${screen === "buyer" ? "active" : ""}`} data-screen="buyer" onClick={(e) => { e.preventDefault(); setScreen("buyer"); setView("list"); }}>👤 Buyer</a>
        <a href="#" className={`nav__item ${screen === "report" ? "active" : ""}`} data-screen="report" onClick={(e) => { e.preventDefault(); setScreen("report"); setView("list"); }}>⚠️ Report</a>
        <button type="button" className="nav__item" onClick={() => { logout(); window.location.reload(); }}>Logout</button>
      </nav>
    </>
  );
}

export default function App() {
  const user = getUser();
  const [authed, setAuthed] = useState(!!user);

  if (!authed || !user) {
    return <AuthScreen onAuthed={() => setAuthed(true)} />;
  }

  if (user.role !== "buyer") {
    return <Navigate to="/" replace />;
  }

  return <BuyerAppShell />;
}
