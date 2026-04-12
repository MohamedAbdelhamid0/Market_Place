// Keep your existing screen navigation working (bottom nav toggles `.active` screens).
const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav__item");

var productRating = 4;

function showScreen(id) {
  screens.forEach((screen) => screen.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  navItems.forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-screen") === id);
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const id = item.getAttribute("data-screen");
    if (id) showScreen(id);
  });
});

const { useEffect, useMemo, useState } = React;

const STORAGE_KEY = "buyerApp.orders.v1";
const STORAGE_RATINGS_KEY = "buyerApp.ratings.v1";

async function loadOrders() {
  const res = await fetch("http://localhost:3000/orders");
  return await res.json();
}

function saveOrders(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("orders:changed"));
}

function loadRatings() {
  try {
    const raw = localStorage.getItem(STORAGE_RATINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveRatings(next) {
  localStorage.setItem(STORAGE_RATINGS_KEY, JSON.stringify(next));
}

function money(n) {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "$0";
  return `$${num.toFixed(0)}`;
}

function stars(rating) {
  const r = Math.max(0, Math.min(5, Math.round((Number(rating) || 0) * 2) / 2));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return "★".repeat(full) + (half ? "⯨" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
}

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Wireless Headphones", price: 59, avgRating: 4.0, category: "Electronics", image: "headphones.jpg" },
  { id: "p2", name: "Smart Watch", price: 120, avgRating: 5.0, category: "Electronics", image: "smartWatch.jpg" },
  { id: "p3", name: "Sneakers", price: 75, avgRating: 3.0, category: "Clothes", image: "sneakers.jpg" },
  { id: "p4", name: "Laptop Bag", price: 40, avgRating: 4.0, category: "Home", image: "laptopbag.jpg" }
];

const OFFERS = [
  { title: "Summer Sale", text: "Up to 40% off trending picks", cta: "Shop deals", bg: "linear-gradient(135deg, #2563eb, #4f46e5)" },
  { title: "Free Delivery", text: "Selected items ship free today", cta: "Browse offers", bg: "linear-gradient(135deg, #0f766e, #14b8a6)" },
  { title: "New Arrivals", text: "Fresh products added this week", cta: "See new items", bg: "linear-gradient(135deg, #7c3aed, #ec4899)" }
];

function Carousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % OFFERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="carousel" aria-label="Offers carousel">
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {OFFERS.map((offer, i) => (
          <article className="carousel-slide" key={offer.title}>
            <div className="carousel-copy">
              <span className="product-badge">Offer {i + 1}</span>
              <h3>{offer.title}</h3>
              <p>{offer.text}</p>
              <div className="carousel-cta">{offer.cta} →</div>
            </div>
            <div className="carousel-visual" style={{ background: offer.bg }} />
          </article>
        ))}
      </div>
      <div className="carousel-dots" aria-label="Carousel navigation">
        {OFFERS.map((offer, i) => (
          <button
            key={offer.title}
            type="button"
            className={`carousel-dot ${i === index ? "active" : ""}`}
            onClick={() => setIndex(i)}
            aria-label={`Go to offer ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function StarRating({ rating = 0, onRate }) {
  const [hover, setHover] = React.useState(null);
  const value = Math.max(0, Math.min(5, Number(hover ?? rating) || 0));
  const starsArr = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="rating" role="radiogroup" aria-label="Rate this item">
        {starsArr.map((star) => {
          const active = star <= value;
          return (
            <span
              key={star}
              className={`star ${active ? "active" : ""}`}
              role="radio"
              aria-checked={star === Math.round(value)}
              tabIndex={0}
              onClick={() => onRate(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onRate(star);
              }}
            >
              ★
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
        {Number(rating || 0).toFixed(0)} / 5
      </div>
    </div>
  );
}

function HomeScreen({ products, onPlaceOrder }) {
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [products]);

  const initialRatings = products.reduce((acc, product) => {
    acc[product.id] = 0;
    return acc;
  }, {});
  const [ratings, setRatings] = useState(initialRatings);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const [view, setView] = useState("list");

  useEffect(() => {
    if (!selectedId && products[0]?.id) setSelectedId(products[0].id);
  }, [products, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q);
      const matchesCategory = category === "All" || p.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? filtered[0] ?? null,
    [products, selectedId, filtered]
  );

  useEffect(() => {
    if (view === "details" && !selected) setView("list");
  }, [view, selected]);

  return (
    <div>
      {view === "details" ? (
        <div className="product-details" aria-live="polite">
          <button
            type="button"
            className="btn"
            style={{ width: "auto", padding: "10px 14px", background: "#e5e7eb", marginTop: 0, marginBottom: 14 }}
            onClick={() => setView("list")}
          >
            ← Back
          </button>

          {selected ? (
            <>
              <div className="header" style={{ marginBottom: 12, color: "var(--text)" }}>
                {selected.name}
              </div>
              <img src={selected.image} alt={selected.name} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 14, marginBottom: 14 }} />
              <p style={{ color: "var(--text-muted)" }}>
                Category: <strong style={{ color: "var(--text)" }}>{selected.category}</strong>
              </p>
              <p style={{ marginTop: 6 }}><strong>{money(selected.price)}</strong></p>
              <p style={{ marginTop: 6 }}>Product rating: <span className="stars">{stars(selected.avgRating)}</span></p>
              <StarRating
                rating={ratings[selected.id] ?? 0}
                onRate={(n) => {
                  const next = { ...ratings, [selected.id]: n };
                  setRatings(next);
                  saveRatings(next);
                }}
              />
              <button className="btn order-btn" type="button" onClick={() => { onPlaceOrder(selected); showScreen("orders"); }}>
                Place Order
              </button>
            </>
          ) : (
            <p>No product selected.</p>
          )}
        </div>
      ) : (
        <>
          <div className="buyer-hero">
            <div className="buyer-hero__greeting">Welcome back</div>
            <div className="buyer-hero__name">Find today’s best offers</div>
          </div>

          <Carousel />

          <div className="buyer-stats">
            <div className="stat-card"><div className="stat-card__value" id="buyer-orders-count">0</div><div className="stat-card__label">Orders</div></div>
            <div className="stat-card"><div className="stat-card__value" id="buyer-total-payment">$0</div><div className="stat-card__label">Total spent</div></div>
            <div className="stat-card"><div className="stat-card__value">4.8</div><div className="stat-card__label">Average rating</div></div>
          </div>

          <div className="header">Marketplace</div>

          <input className="search-bar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." aria-label="Search products" />

          <div className="categories" role="tablist" aria-label="Categories">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="category"
                onClick={() => setCategory(c)}
                style={{ border: "none", outline: "none", background: c === category ? "#eaf0ff" : "white" }}
                aria-pressed={c === category}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="product-grid">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="product-card"
                onClick={() => { setSelectedId(p.id); setView("details"); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedId(p.id);
                    setView("details");
                  }
                }}
              >
                <div className="product-badge">{p.category}</div>
                <img className="product-img" src={p.image} alt={p.name} />
                <div className="product-title">{p.name}</div>
                <div className="product-rating">
                  <span className="stars">{stars(p.avgRating)}</span>
                  <span className="rating-value">({Number(p.avgRating || 0).toFixed(1)})</span>
                </div>
                <div className="product-price">{money(p.price)}</div>
              </div>
            ))}
          </div>

          {!filtered.length ? <div className="product-details" style={{ marginTop: 16 }}>No products match your search.</div> : null}
        </>
      )}
    </div>
  );
}

function OrdersScreen() {
  const [orders, setOrders] = useState(() => loadOrders());
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const onChanged = () => setOrders(loadOrders());
    window.addEventListener("orders:changed", onChanged);
    return () => window.removeEventListener("orders:changed", onChanged);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  async function updateOrder(id, patch) {
    await fetch(`http://localhost:3000/orders/${id}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({status: "Delivered"})
    });
    setOrders(next);
    saveOrders(next);
  }

  function removeOrder(id) {
    const next = orders.filter((o) => o.id !== id);
    setOrders(next);
    saveOrders(next);
  }

  return (
    <div>
      <h1 className="header">My Orders</h1>

      <div className="categories" aria-label="Order filters">
        {["All", "Processing", "Shipping", "Delivered"].map((f) => (
          <button
            key={f}
            type="button"
            className="category"
            onClick={() => setFilter(f)}
            style={{ border: "none", outline: "none", background: f === filter ? "#eaf0ff" : "white" }}
            aria-pressed={f === filter}
          >
            {f}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="order-card">
          <div className="order-card__title">No orders yet</div>
          <div style={{ color: "var(--text-muted)" }}>Place an order from Home and it will show up here.</div>
        </div>
      ) : (
        filtered.map((o) => {
          const statusClass =
            o.status === "Delivered"
              ? "order-status--delivered"
              : o.status === "Shipping"
                ? "order-status--shipping"
                : "order-status--processing";

          return (
            <article key={o.id} className="order-card">
              <h2 className="order-card__title">{o.productName}</h2>
              <div className={`order-status ${statusClass}`}>{o.status}</div>

              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Status
                  <select
                    value={o.status}
                    onChange={(e) => updateOrder(o.id, { status: e.target.value })}
                    style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipping">Shipping</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </label>

                <div className="comment-section">
                  <textarea
                    className="comment-box"
                    placeholder="Add a comment or review for this order…"
                    rows={3}
                    value={o.comment || ""}
                    onChange={(e) => updateOrder(o.id, { comment: e.target.value })}
                  />
                  <button type="button" className="rate-btn" onClick={() => alert("Comment saved")}>Submit Comment</button>
                  <button type="button" className="btn" style={{ background: "#ef4444", color: "white" }} onClick={() => removeOrder(o.id)}>Remove Order</button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function mount() {
  const homeRoot = document.getElementById("home-root");
  const ordersRoot = document.getElementById("orders-root");
  if (!homeRoot || !ordersRoot) return;

  const products = DEFAULT_PRODUCTS;

  function updateBuyerTotals() {
    const orders = loadOrders();
    const total = orders.reduce((sum, o) => sum + (Number(o.productPrice) || 0), 0);

    const totalEl = document.getElementById("buyer-total-payment");
    if (totalEl) totalEl.textContent = money(total);

    const countEl = document.getElementById("buyer-orders-count");
    if (countEl) countEl.textContent = String(orders.length);
  }

  async function placeOrder(product) {
    await fetch("http://localhost:3000/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        productName: product.name,
        productPrice: product.price
      })
    });
  }

  ReactDOM.createRoot(homeRoot).render(<HomeScreen products={products} onPlaceOrder={placeOrder} />);
  ReactDOM.createRoot(ordersRoot).render(<OrdersScreen />);

  updateBuyerTotals();
  window.addEventListener("orders:changed", updateBuyerTotals);
}

mount();
