const { useState } = React;

function ProductForm() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(null);
  const [image, setImage] = useState("");

  const value = hover ?? rating;
  const clampHalf = (v) => Math.max(0, Math.min(5, Math.round(v * 2) / 2));
  const setValue = (v) => setRating(clampHalf(v));

  const handleImage = (file) => {
    if (file instanceof File) setImage(URL.createObjectURL(file));
  };

  const handleFileChange = (e) => handleImage(e.target.files?.[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    handleImage(e.dataTransfer.files?.[0]);
  };
  const handleDragOver = (e) => e.preventDefault();

  const onStarsKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setValue(rating + 0.5);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setValue(rating - 0.5);
    }
    if (e.key === "Home") {
      e.preventDefault();
      setValue(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setValue(5);
    }
  };

  return (
    <div>
      <div className="form-group rating-group">
        <label>Initial rating</label>
        <div
          className="stars"
          role="slider"
          aria-label="Initial rating"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={rating}
          aria-valuetext={`${rating} out of 5`}
          tabIndex={0}
          onKeyDown={onStarsKeyDown}
          onMouseLeave={() => setHover(null)}
        >
          {[...Array(5)].map((_, i) => {
            const starValue = i + 1;
            const isFull = value >= starValue;
            const isHalf = !isFull && value >= starValue - 0.5;
            const icon = isFull ? "★" : isHalf ? "⯨" : "☆";

            return (
              <div key={starValue} className="star">
                <button
                  type="button"
                  className="hit hit-left"
                  aria-label={starValue === 1 ? "Set rating to 0" : `Set rating to ${starValue - 0.5}`}
                  onMouseEnter={() => setHover(starValue === 1 ? 0 : starValue - 0.5)}
                  onFocus={() => setHover(starValue === 1 ? 0 : starValue - 0.5)}
                  onBlur={() => setHover(null)}
                  onClick={() => setValue(starValue === 1 ? 0 : starValue - 0.5)}
                />
                <button
                  type="button"
                  className="hit hit-right"
                  aria-label={`Set rating to ${starValue}`}
                  onMouseEnter={() => setHover(starValue)}
                  onFocus={() => setHover(starValue)}
                  onBlur={() => setHover(null)}
                  onClick={() => setValue(starValue)}
                />
                <span className="star-icon" aria-hidden="true">
                  {icon}
                </span>
              </div>
            );
          })}
        </div>
        <p className="rating-value">{rating} / 5</p>
      </div>

      <div className="form-group image-group">
        <label>Product image</label>
        <div className="image-frame" onDrop={handleDrop} onDragOver={handleDragOver}>
          {image ? (
            <img src={image} alt="preview" />
          ) : (
            <div className="placeholder">
              <div className="upload-icon">📷</div>
              <div className="upload-title">Upload a product image</div>
              <div className="upload-hint">Drag & drop, or click the button below</div>
            </div>
          )}
          <label className="upload-button">
            <span>Choose image</span>
            <input type="file" accept="image/*" onChange={handleFileChange} hidden />
          </label>
        </div>
      </div>
    </div>
  );
}

let products = [
  {
    name: "Wireless Headphones",
    price: 159,
    rating: 4.8,
    image: "headphones.jpg",
    category: "Electronics",
    inventory: 32,
    orders: 120
  },
  {
    name: "Smart Watch",
    price: 220,
    rating: 5.0,
    image: "smartWatch.jpg",
    category: "Wearables",
    inventory: 18,
    orders: 86
  },
  {
    name: "Camera Lens",
    price: 899,
    rating: 4.3,
    image: "lens.jpg",
    category: "Photography",
    inventory: 7,
    orders: 42
  }
];

let orders = [
  { product: "Headphones", buyer: "Ali", status: "Pending" },
  { product: "Smart Watch", buyer: "Sara", status: "Preparing" }
];

let activeOrderFilter = "All";

function renderProducts(list = products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = "";
  list.forEach((p) => {
    const stars = "⭐".repeat(Math.round(p.rating));
    grid.innerHTML += `
      <div class="card">
        <div class="card-img-wrap">
          <img src="${p.image}" alt="${p.name}">
          <div class="badge badge-category">${p.category || "General"}</div>
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          <div class="card-meta-row">
            <div class="price">$${p.price}</div>
            <div class="rating">${stars} (${p.rating})</div>
          </div>
          <div class="card-meta-sub">
            <span>Inventory: ${p.inventory ?? "—"}</span>
            <span>Orders: ${p.orders ?? 0}</span>
          </div>
        </div>
      </div>
    `;
  });
}

function renderOrders() {
  const container = document.getElementById("ordersList");
  if (!container) return;
  container.innerHTML = "";
  const visible = orders.filter((o) => activeOrderFilter === "All" || o.status === activeOrderFilter);
  if (!visible.length) {
    container.innerHTML = `<div class="order-list-empty">No orders match this filter.</div>`;
    return;
  }
  visible.forEach((o, i) => {
    container.innerHTML += `
      <div class="order-card">
        <div class="order-main">
          <h3>${o.product}</h3>
          <p>Buyer: <strong>${o.buyer}</strong></p>
          <span class="order-status order-status-${o.status.toLowerCase()}">${o.status}</span>
        </div>
        <div class="order-actions">
          <select onchange="changeStatus(${i}, this.value)">
            <option ${o.status === "Pending" ? "selected" : ""}>Pending</option>
            <option ${o.status === "Preparing" ? "selected" : ""}>Preparing</option>
            <option ${o.status === "Delivered" ? "selected" : ""}>Delivered</option>
          </select>
          <button class="flag-btn" onclick="flagBuyer('${o.buyer}')">Flag Buyer</button>
        </div>
      </div>
    `;
  });
}

function changeStatus(i, status) {
  orders[i].status = status;
  renderOrders();
}

function flagBuyer(name) {
  alert(name + " flagged");
}

function addProduct() {
  const nameEl = document.getElementById("name");
  const priceEl = document.getElementById("price");
  const ratingEl = document.getElementById("rating");
  const categoryEl = document.getElementById("category");
  if (!nameEl || !priceEl || !categoryEl) return;

  const name = nameEl.value.trim();
  const price = parseFloat(priceEl.value);
  const rating = parseFloat(ratingEl?.value || "5");
  const category = categoryEl.value || "General";

  if (!name || isNaN(price)) {
    alert("Please enter at least a product name and valid price.");
    return;
  }

  products.push({
    name,
    price,
    rating: isNaN(rating) ? 5 : rating,
    image: "https://images.unsplash.com/photo-1518441902110-3c6f91e2d7d0?w=500",
    category,
    inventory: 0,
    orders: 0
  });

  nameEl.value = "";
  priceEl.value = "";
  if (ratingEl) ratingEl.value = "";
  categoryEl.value = categoryEl.options[0]?.value || "";

  const searchInput = document.getElementById("homeSearchInput");
  if (searchInput) searchInput.value = "";

  renderProducts();
  showScreen("home", document.querySelector('.nav-btn[onclick*="home"]'));
  alert("Product added");
}

function showScreen(id, btn) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach((n) => n.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (id === "home") renderProducts();
  if (id === "orders") renderOrders();
}

function attachNavHandlers() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("onclick")?.match(/showScreen\('([^']+)'/)?.[1];
      if (id) showScreen(id, btn);
    });
  });
}

function attachSearchHandler() {
  const searchInput = document.getElementById("homeSearchInput");
  if (!searchInput) return;
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return renderProducts();
    renderProducts(products.filter((p) => p.name.toLowerCase().includes(query) || (p.category || "").toLowerCase().includes(query)));
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

function mountApp() {
  attachNavHandlers();
  attachSearchHandler();
  attachOrderFilterHandlers();
  renderProducts();
  renderOrders();
  showScreen("home", document.querySelector('.nav-btn[onclick*="home"]'));

  const rootEl = document.getElementById("root");
  if (rootEl) ReactDOM.createRoot(rootEl).render(<ProductForm />);
}

document.addEventListener("DOMContentLoaded", mountApp);
if (document.readyState !== "loading") mountApp();

window.changeStatus = changeStatus;
window.flagBuyer = flagBuyer;
window.addProduct = addProduct;
window.showScreen = showScreen;
window.renderProducts = renderProducts;
window.renderOrders = renderOrders;
window.setActiveOrderFilter = function (status) {
  activeOrderFilter = status || "All";
  document.querySelectorAll(".order-filters .filter-pill").forEach((b) => b.classList.remove("active"));
  const activeBtn = document.querySelector(`.order-filters .filter-pill[data-status="${activeOrderFilter}"]`);
  if (activeBtn) activeBtn.classList.add("active");
  renderOrders();
};
