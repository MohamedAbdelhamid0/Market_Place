// ---------- DATA ----------

// Product data (enriched with category, inventory, orders)
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

// Orders data (can be rendered with richer UI later via CSS)
let orders = [
  { product: "Headphones", buyer: "Ali", status: "Pending" },
  { product: "Smart Watch", buyer: "Sara", status: "Preparing" }
];


// ---------- SCREEN NAVIGATION ----------

function showScreen(id, btn) {
  // Hide all screens
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

  // Show selected screen
  const target = document.getElementById(id);
  if (target) target.classList.add("active");

  // Update nav button styling
  document.querySelectorAll(".nav-btn").forEach(n => n.classList.remove("active"));
  if (btn) btn.classList.add("active");

  // Render content for specific screens
  if (id === "home") renderProducts();
  if (id === "orders") renderOrders();
}


// ---------- PRODUCTS (HOME) ----------

// Render product cards (optionally from a filtered list)
function renderProducts(list = products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = ""; // clear before rendering

  list.forEach(p => {
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

// Add new product from the Add Item form
function addProduct() {
  const nameEl = document.getElementById("name");
  const priceEl = document.getElementById("price");
  const ratingEl = document.getElementById("rating");
  const categoryEl = document.getElementById("category");

  if (!nameEl || !priceEl || !categoryEl) return;

  const name = nameEl.value.trim();
  const price = parseFloat(priceEl.value);
  const rating = parseFloat(ratingEl.value || "5");
  const category = categoryEl.value || "General";

  if (!name || isNaN(price)) {
    alert("Please enter at least a product name and valid price.");
    return;
  }

  const product = {
    name,
    price,
    rating: isNaN(rating) ? 5 : rating,
    image: "https://images.unsplash.com/photo-1518441902110-3c6f91e2d7d0?w=500",
    category,
    inventory: 0,
    orders: 0
  };

  products.push(product);

  // Clear form
  nameEl.value = "";
  priceEl.value = "";
  if (ratingEl) ratingEl.value = "";
  categoryEl.value = categoryEl.options[0]?.value || "";

  // Reset search and re-render full list
  const searchInput = document.querySelector(".search-bar input");
  if (searchInput) searchInput.value = "";

  renderProducts();

  // Go back to home, highlight the Home nav button
  const homeBtn = document.querySelector(".nav-btn");
  showScreen("home", homeBtn);

  alert("Product added");
}


// ---------- ORDERS ----------

function renderOrders() {
  const container = document.getElementById("ordersList");
  if (!container) return;

  container.innerHTML = "";

  orders.forEach((o, i) => {
    container.innerHTML += `
      <div class="order-card">
        <div class="order-main">
          <h3>${o.product}</h3>
          <p>Buyer: <strong>${o.buyer}</strong></p>
          <span class="order-status order-status-${o.status.toLowerCase()}">
            ${o.status}
          </span>
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
  renderOrders(); // refresh to show updated status
}

function flagBuyer(name) {
  alert(name + " flagged");
}


// ---------- SEARCH (HOME) ----------

const searchInput = document.querySelector(".search-bar input");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderProducts();
      return;
    }

    const filtered = products.filter(p => {
      const name = p.name.toLowerCase();
      const category = (p.category || "").toLowerCase();
      return name.includes(query) || category.includes(query);
    });

    renderProducts(filtered);
  });
}


// ---------- INITIAL RENDER ----------

renderProducts();
renderOrders();
