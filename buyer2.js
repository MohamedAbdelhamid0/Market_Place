const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav__item");

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

const API_BASE = "http://localhost:4000";
const SESSION_KEY = "marketplace.auth.user";

function getSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

const currentUser = getSessionUser();
if (!currentUser || currentUser.role !== "buyer") {
  window.location.href = "Login.html";
}

const buyerDisplayName = String(currentUser?.name || "Buyer");

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function apiSend(path, method, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
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
  const [hover, setHover] = useState(null);
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

function HomeScreen({ products, onPlaceOrder, onRateProduct, buyerName }) {
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
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
      const matchesCategory = category === "All" || p.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? filtered[0] ?? null,
    [products, selectedId, filtered]
  );

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
              <div className="header" style={{ marginBottom: 12, color: "var(--text)" }}>{selected.name}</div>
              <img src={selected.image || ""} alt={selected.name} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 14, marginBottom: 14 }} />
              <p style={{ color: "var(--text-muted)" }}>Category: <strong style={{ color: "var(--text)" }}>{selected.category}</strong></p>
              <p style={{ marginTop: 6 }}><strong>{money(selected.price)}</strong></p>
              <p style={{ marginTop: 6 }}>Product rating: <span className="stars">{stars(selected.avgRating)}</span></p>
              <p style={{ marginTop: 6, color: "var(--text-muted)" }}>Delivery estimate: {selected.deliveryEstimateDays || 0} day(s)</p>
              <StarRating
                rating={ratings[selected.id] ?? 0}
                onRate={async (n) => {
                  const next = { ...ratings, [selected.id]: n };
                  setRatings(next);
                  try {
                    await onRateProduct(selected, n);
                    alert("Rating submitted.");
                  } catch (err) {
                    alert(err.message || "Failed to submit rating");
                  }
                }}
              />
              <button
                className="btn order-btn"
                type="button"
                onClick={async () => {
                  try {
                    await onPlaceOrder(selected);
                    showScreen("orders");
                  } catch (err) {
                    alert(err.message || "Order failed");
                  }
                }}
              >
                Place Order
              </button>
            </>
          ) : <p>No product selected.</p>}
        </div>
      ) : (
        <>
          <div className="buyer-hero">
            <div className="buyer-hero__greeting">Welcome back</div>
            <div className="buyer-hero__name">{buyerName}</div>
          </div>

          <Carousel />

          <div className="buyer-stats">
            <div className="stat-card"><div className="stat-card__value" data-buyer-orders-count>0</div><div className="stat-card__label">Orders</div></div>
            <div className="stat-card"><div className="stat-card__value" data-buyer-total-payment>$0</div><div className="stat-card__label">Total spent</div></div>
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
                <img className="product-img" src={p.image || ""} alt={p.name} />
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

function OrdersScreen({ buyerId, refreshSignal, onTotalsChanged }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  async function fetchOrders() {
    setLoading(true);
    try {
      const data = await apiGet(`/api/buyer/${buyerId}/orders`);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      onTotalsChanged(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, [refreshSignal]);

  const filtered = useMemo(() => {
    if (filter === "All") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  async function saveComment(order) {
    try {
      await apiSend(`/api/buyer/orders/${order.id}/comment`, "POST", {
        buyerId,
        comment: order.comment || ""
      });
      alert("Comment saved");
    } catch (err) {
      alert(err.message || "Failed to save comment");
    }
  }

  async function removeOrder(id) {
    try {
      await apiSend(`/api/buyer/orders/${id}?buyerId=${buyerId}`, "DELETE");
      await fetchOrders();
    } catch (err) {
      alert(err.message || "Failed to remove order");
    }
  }

  return (
    <div>
      <h1 className="header">My Orders</h1>

      <div className="categories" aria-label="Order filters">
        {["All", "Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"].map((f) => (
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

      {loading ? <div className="order-card">Loading orders...</div> : null}

      {!loading && !filtered.length ? (
        <div className="order-card">
          <div className="order-card__title">No orders yet</div>
          <div style={{ color: "var(--text-muted)" }}>Place an order from Home and it will show up here.</div>
        </div>
      ) : null}

      {!loading && filtered.map((o) => {
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

            <div className="comment-section">
              <textarea
                className="comment-box"
                placeholder="Add a comment or review for this order…"
                rows={3}
                value={o.comment || ""}
                onChange={(e) => {
                  const next = orders.map((item) => item.id === o.id ? { ...item, comment: e.target.value } : item);
                  setOrders(next);
                }}
              />
              <button type="button" className="rate-btn" onClick={() => saveComment(o)}>Submit Comment</button>
              <button type="button" className="btn" style={{ background: "#ef4444", color: "white" }} onClick={() => removeOrder(o.id)}>Remove Order</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function mount() {
  const homeRoot = document.getElementById("home-root");
  const ordersRoot = document.getElementById("orders-root");
  if (!homeRoot || !ordersRoot) return;

  const buyerId = currentUser?.id;
  if (!buyerId) {
    window.location.href = "Login.html";
    return;
  }

  let rerenderOrders = 0;

  function hydrateBuyerIdentity() {
    const profileName = document.getElementById("buyer-profile-name");
    if (profileName) profileName.textContent = buyerDisplayName;
  }

  function updateBuyerTotalsFromOrders(orders) {
    const total = (orders || []).reduce((sum, o) => sum + ((Number(o.productPrice) || 0) * (Number(o.quantity) || 1)), 0);
    const count = String((orders || []).length);
    const spent = money(total);

    document.querySelectorAll("[data-buyer-total-payment]").forEach((el) => {
      el.textContent = spent;
    });

    document.querySelectorAll("[data-buyer-orders-count]").forEach((el) => {
      el.textContent = count;
    });
  }

  async function loadCatalog() {
    const data = await apiGet("/api/catalog");
    return Array.isArray(data.products) ? data.products : [];
  }

  async function placeOrder(product) {
    await apiSend("/api/orders", "POST", {
      buyerId,
      productId: product.id,
      quantity: 1
    });
    rerenderOrders += 1;
    renderOrdersScreen();
    alert("Order placed successfully!");
  }

  async function rateProduct(product, rating) {
    const ordersData = await apiGet(`/api/buyer/${buyerId}/orders`);
    const matchingOrder = (ordersData.orders || []).find((o) => Number(o.productId) === Number(product.id));
    if (!matchingOrder) {
      throw new Error("Place an order for this item before rating it.");
    }

    await apiSend(`/api/buyer/orders/${matchingOrder.id}/review`, "POST", {
      orderId: matchingOrder.id,
      productId: product.id,
      buyerId,
      rating,
      reviewComment: ""
    });
  }

  function attachReportForm() {
    const submitButton = document.querySelector("#report .order-btn");
    const orderSelect = document.getElementById("report-order");
    const sellerInput = document.getElementById("report-seller");
    const reasonInput = document.getElementById("report-reason");
    if (!submitButton || !orderSelect || !sellerInput || !reasonInput) return;

    let reportableOrders = [];

    function renderOrderOptions(orders) {
      reportableOrders = Array.isArray(orders) ? orders : [];
      orderSelect.innerHTML = "";

      if (!reportableOrders.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No eligible orders available";
        orderSelect.appendChild(option);
        orderSelect.disabled = true;
        sellerInput.value = "No seller available";
        submitButton.disabled = true;
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select an order";
      orderSelect.appendChild(placeholder);

      reportableOrders.forEach((order) => {
        const option = document.createElement("option");
        option.value = String(order.id);
        option.textContent = `#${order.id} - ${order.productName} (${order.status})`;
        orderSelect.appendChild(option);
      });

      orderSelect.disabled = false;
      submitButton.disabled = false;
      sellerInput.value = "";
    }

    async function loadReportableOrders() {
      try {
        const ordersData = await apiGet(`/api/buyer/${buyerId}/orders`);
        const activeOrders = (ordersData.orders || []).filter((o) => o.status !== "Cancelled");
        renderOrderOptions(activeOrders);
      } catch (err) {
        orderSelect.innerHTML = '<option value="">Failed to load orders</option>';
        orderSelect.disabled = true;
        submitButton.disabled = true;
        sellerInput.value = "";
        console.error(err);
      }
    }

    orderSelect.addEventListener("change", () => {
      const selectedOrderId = Number(orderSelect.value);
      const selectedOrder = reportableOrders.find((o) => Number(o.id) === selectedOrderId);
      sellerInput.value = selectedOrder ? `${selectedOrder.sellerName} (ID: ${selectedOrder.sellerId})` : "";
    });

    submitButton.addEventListener("click", async () => {
      const orderId = Number(orderSelect.value);
      const selectedOrder = reportableOrders.find((o) => Number(o.id) === orderId);
      const reason = reasonInput.value.trim();
      if (!selectedOrder || !reason) {
        alert("Select an order and provide a reason.");
        return;
      }

      try {
        await apiSend("/api/flags/seller", "POST", {
          orderId: selectedOrder.id,
          sellerId: selectedOrder.sellerId,
          buyerId,
          reason: "Other",
          details: reason
        });

        orderSelect.value = "";
        sellerInput.value = "";
        reasonInput.value = "";
        alert("Seller report submitted successfully.");
      } catch (err) {
        alert(err.message || "Failed to submit report");
      }
    });

    loadReportableOrders();

    document.querySelectorAll('.nav__item[data-screen="report"]').forEach((item) => {
      item.addEventListener("click", loadReportableOrders);
    });
  }

  async function renderHomeScreen() {
    try {
      const products = await loadCatalog();
      ReactDOM.createRoot(homeRoot).render(
        <HomeScreen
          products={products}
          onPlaceOrder={placeOrder}
          onRateProduct={rateProduct}
          buyerName={buyerDisplayName}
        />
      );
    } catch (err) {
      homeRoot.innerHTML = `<div class="order-card">${err.message || "Failed to load catalog"}</div>`;
    }
  }

  function renderOrdersScreen() {
    ReactDOM.createRoot(ordersRoot).render(
      <OrdersScreen
        buyerId={buyerId}
        refreshSignal={rerenderOrders}
        onTotalsChanged={updateBuyerTotalsFromOrders}
      />
    );
  }

  renderHomeScreen();
  renderOrdersScreen();
  hydrateBuyerIdentity();
  attachReportForm();
}

mount();
