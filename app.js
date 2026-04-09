const { useState } = React;

const API_BASE = "http://localhost:4000";
const SESSION_KEY = "marketplace.auth.user";

let products = [];
let orders = [];
let activeOrderFilter = "All";

function normalizeImageUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value;
}

function getCurrentSeller() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.role !== "seller") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function ProductForm() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(null);
  const [image, setImage] = useState("");

  const value = hover ?? rating;

  const handleImage = (file) => {
    if (file instanceof File) setImage(URL.createObjectURL(file));
  };

  return (
    <div>
      <div className="form-group rating-group">
        <label>Initial rating</label>
        <div className="stars" onMouseLeave={() => setHover(null)}>
          {[...Array(5)].map((_, i) => {
            const starValue = i + 1;
            const isFull = value >= starValue;
            return (
              <button
                key={starValue}
                type="button"
                className="star"
                style={{ color: isFull ? "#f59e0b" : "#94a3b8", background: "transparent", border: "none", fontSize: "22px", cursor: "pointer" }}
                onMouseEnter={() => setHover(starValue)}
                onClick={() => setRating(starValue)}
              >
                ★
              </button>
            );
          })}
        </div>
        <p className="rating-value">{rating} / 5</p>
      </div>

      <div className="form-group image-group">
        <label>Product image</label>
        <div className="image-frame" onDrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files?.[0]); }} onDragOver={(e) => e.preventDefault()}>
          {image ? (
            <img src={image} alt="preview" />
          ) : (
            <div className="placeholder">
              <div className="upload-title">Upload a product image</div>
            </div>
          )}
          <label className="upload-button">
            <span>Choose image</span>
            <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} hidden />
          </label>
        </div>
      </div>
    </div>
  );
}

function renderProducts(list = products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = "";

  list.forEach((p) => {
    const stars = "⭐".repeat(Math.max(1, Math.round(p.rating || 0)));
    const image = normalizeImageUrl(p.image) || "https://images.unsplash.com/photo-1518441902110-3c6f91e2d7d0?w=500";
    grid.innerHTML += `
      <div class="card">
        <img src="${image}" alt="${p.name}">
        <div class="card-body">
          <div class="card-title-row">
            <div class="card-title">${p.name}</div>
            <div class="card-chip">${p.category || "General"}</div>
          </div>
          <div class="price">$${Number(p.price || 0).toFixed(2)}</div>
          <div class="card-meta">
            <span>${stars} (${Number(p.rating || 0).toFixed(1)})</span>
            <span>Stock: ${p.inventory ?? 0}</span>
          </div>
          <div class="card-meta">
            <span>Delivery: ${p.deliveryEstimateDays ?? 1} day(s)</span>
            <span>Orders: ${p.orders ?? 0}</span>
          </div>
        </div>
      </div>
    `;
  });
}

function getOrderClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "order-status-delivered";
  if (s === "preparing" || s === "processing") return "order-status-preparing";
  return "order-status-pending";
}

function renderOrders() {
  const container = document.getElementById("ordersList");
  if (!container) return;

  const visible = orders.filter((o) => activeOrderFilter === "All" || o.status === activeOrderFilter);
  if (!visible.length) {
    container.innerHTML = `<div class="order-list-empty">No orders match this filter.</div>`;
    return;
  }

  container.innerHTML = visible.map((o) => `
    <div class="order-card">
      <div class="order-main">
        <h3>${o.product}</h3>
        <p>Buyer: <strong>${o.buyer}</strong></p>
        <span class="order-status ${getOrderClass(o.status)}">${o.status}</span>
      </div>
      <div class="order-actions">
        <select onchange="changeStatus(${o.id}, this.value)">
          ${["Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"]
            .map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
        <button class="flag-btn" onclick="flagBuyer(${o.id}, ${o.buyerId}, '${o.buyer.replace(/'/g, "\\'")}')">Flag Buyer</button>
      </div>
    </div>
  `).join("");
}

async function loadProducts() {
  const seller = getCurrentSeller();
  if (!seller) return;
  const data = await api(`/api/seller/${seller.id}/products`);
  products = data.products || [];
  renderProducts();
}

async function loadOrders() {
  const seller = getCurrentSeller();
  if (!seller) return;
  const data = await api(`/api/seller/${seller.id}/orders`);
  orders = data.orders || [];
  renderOrders();
}

async function loadSellerProfile() {
  const seller = getCurrentSeller();
  if (!seller) return;

  const data = await api(`/api/seller/${seller.id}/profile`);
  const profile = data.profile || {};

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  };

  set("profileName", profile.ownerName);
  set("profileEmail", profile.email);
  set("profileStoreName", profile.businessName);
  set("profileCity", profile.city);
  set("profileCountry", profile.country);
  set("profileAddress", profile.addressLine);
  set("profilePhone", profile.phone);
  set("profileSupportEmail", profile.supportEmail);

  const heading = document.getElementById("profileStoreHeading");
  if (heading) heading.textContent = profile.businessName || "Your store";
}

async function saveSellerProfile() {
  const seller = getCurrentSeller();
  if (!seller) return;

  const ownerName = document.getElementById("profileName")?.value.trim();
  const email = document.getElementById("profileEmail")?.value.trim();
  const businessName = document.getElementById("profileStoreName")?.value.trim();
  const city = document.getElementById("profileCity")?.value.trim();
  const country = document.getElementById("profileCountry")?.value.trim();
  const addressLine = document.getElementById("profileAddress")?.value.trim();
  const phone = document.getElementById("profilePhone")?.value.trim();
  const supportEmail = document.getElementById("profileSupportEmail")?.value.trim();

  if (!ownerName || !email || !businessName) {
    alert("Name, email, and store name are required.");
    return;
  }

  try {
    await api(`/api/seller/${seller.id}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ ownerName, email, businessName, city, country, addressLine, phone, supportEmail })
    });

    const nextSession = { ...seller, name: ownerName, businessName, email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    alert("Profile updated.");
    await loadSellerProfile();
  } catch (err) {
    alert(err.message || "Failed to save profile");
  }
}

async function changeStatus(orderId, status) {
  const seller = getCurrentSeller();
  if (!seller) return;

  try {
    await api(`/api/seller/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ sellerId: seller.id, status })
    });

    const target = orders.find((o) => o.id === orderId);
    if (target) target.status = status;
    renderOrders();
  } catch (err) {
    alert(err.message || "Failed to update status");
  }
}

async function flagBuyer(orderId, buyerId, buyerName) {
  const seller = getCurrentSeller();
  if (!seller) return;

  try {
    await api(`/api/seller/flags/buyer`, {
      method: "POST",
      body: JSON.stringify({
        orderId,
        buyerId,
        sellerId: seller.id,
        reason: "Other",
        details: `Seller flagged buyer ${buyerName}`
      })
    });
    alert(`${buyerName} flagged successfully.`);
  } catch (err) {
    alert(err.message || "Failed to flag buyer");
  }
}

async function addProduct() {
  const seller = getCurrentSeller();
  if (!seller) return;

  const name = document.getElementById("name")?.value.trim();
  const category = document.getElementById("category")?.value;
  const price = Number(document.getElementById("price")?.value || 0);
  const stock = Number(document.getElementById("stock")?.value || 0);
  const deliveryDays = Number(document.getElementById("deliveryDays")?.value || 1);
  const description = document.getElementById("description")?.value.trim();
  const imageUrl = normalizeImageUrl(document.getElementById("imageUrl")?.value || "");

  if (!name || !category || !Number.isFinite(price) || price <= 0 || deliveryDays < 1) {
    alert("Please fill valid product name, category, price, and delivery estimate.");
    return;
  }

  try {
    await api(`/api/seller/products`, {
      method: "POST",
      body: JSON.stringify({
        sellerId: seller.id,
        name,
        category,
        price,
        inventory: Math.max(0, stock),
        deliveryEstimateDays: deliveryDays,
        description,
        image: imageUrl
      })
    });

    alert("Product added.");
    await loadProducts();
    showScreen("home", document.querySelector(".nav-btn[onclick*=\"home\"]"));
  } catch (err) {
    alert(err.message || "Failed to add product");
  }
}

function showScreen(id, btn) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (id === "home") renderProducts();
  if (id === "orders") renderOrders();
  if (id === "profile") loadSellerProfile().catch((err) => {
    alert(err.message || "Failed to load profile");
  });
}

function attachSearchHandler() {
  const searchInput = document.getElementById("homeSearchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return renderProducts();
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      String(p.category || "").toLowerCase().includes(q)
    );
    renderProducts(filtered);
  });
}

function attachOrderFilterHandlers() {
  document.querySelectorAll(".order-filters .filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeOrderFilter = btn.getAttribute("data-status") || "All";
      document.querySelectorAll(".order-filters .filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderOrders();
    });
  });
}

async function mountApp() {
  const seller = getCurrentSeller();
  if (!seller) {
    alert("Please login as a seller first.");
    window.location.href = "Login.html";
    return;
  }

  const rootEl = document.getElementById("root");
  if (rootEl) ReactDOM.createRoot(rootEl).render(<ProductForm />);

  attachSearchHandler();
  attachOrderFilterHandlers();

  try {
    await Promise.all([loadProducts(), loadOrders(), loadSellerProfile()]);
  } catch (err) {
    alert(err.message || "Failed to load seller data");
  }

  showScreen("home", document.querySelector(".nav-btn[onclick*=\"home\"]"));
}

document.addEventListener("DOMContentLoaded", mountApp);
if (document.readyState !== "loading") mountApp();

window.changeStatus = changeStatus;
window.flagBuyer = flagBuyer;
window.addProduct = addProduct;
window.showScreen = showScreen;
window.saveSellerProfile = saveSellerProfile;
