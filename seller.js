// ==================== Global State ====================
let currentUser = null;
let allProducts = [];
let allCategories = [];
let allOrders = [];
let currentEditProductId = null;
let currentFilter = 'all';
let currentFlagOrderId = null;
let currentFlagBuyerId = null;
let currentFlagBuyerName = null;

const API_BASE = 'http://localhost:4000/api';
const SESSION_KEY = 'marketplace.auth.user';

// ==================== Initialize ====================
async function initializePage() {
  currentUser = JSON.parse(localStorage.getItem(SESSION_KEY));
  
  if (!currentUser || currentUser.role !== 'seller') {
    window.location.href = 'Login.html';
    return;
  }

  // Set business name in header
  document.getElementById('businessName').textContent = currentUser.businessName || 'Seller Dashboard';

  // Load all data
  await loadCategories();
  await loadProducts();
  await loadOrders();
  await loadSellerProfile();
  
  // Initialize dashboard
  renderDashboard();
  renderCategoryFilters();
  renderProducts();
  renderOrders();
}

// ==================== API Calls ====================
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/categories`);
    const data = await response.json();
    allCategories = data.categories || [];
    populateCategorySelects();
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/seller/${currentUser.id}/products`);
    const data = await response.json();
    allProducts = (data.products || []).map((p) => ({
      ...p,
      image: normalizeImageUrl(p.image)
    }));
  } catch (error) {
    console.error('Failed to load products:', error);
    showAlert('Failed to load products', 'error');
  }
}

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/seller/${currentUser.id}/orders`);
    const data = await response.json();
    allOrders = (data.orders || []).map((order) => ({
      ...order,
      buyer_name: order.buyer_name || order.buyer || 'Unknown',
      buyer_id: order.buyer_id || order.buyerId || null,
      created_at: order.created_at || null,
      total_amount: Number(order.total_amount || 0)
    }));
  } catch (error) {
    console.error('Failed to load orders:', error);
    showAlert('Failed to load orders', 'error');
  }
}

async function loadSellerProfile() {
  try {
    document.getElementById('profileBusinessName').value = currentUser.businessName || '';
    document.getElementById('profileOwnerName').value = currentUser.name || '';
    document.getElementById('profileEmail').value = currentUser.email || '';
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

async function getProductDetails(productId) {
  try {
    const response = await fetch(`${API_BASE}/seller/products/${productId}`);
    const data = await response.json();
    return data.product;
  } catch (error) {
    console.error('Failed to fetch product details:', error);
    showAlert('Failed to load product details', 'error');
    return null;
  }
}

async function updateProduct(productId, updates) {
  try {
    const response = await fetch(`${API_BASE}/seller/products/${productId}`, {
      method: 'PUT',
      body: updates
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    showAlert('Product updated successfully', 'success');
    await loadProducts();
    renderProducts();
    renderDashboard();
    return true;
  } catch (error) {
    console.error('Failed to update product:', error);
    showAlert('Failed to update product: ' + error.message, 'error');
    return false;
  }
}

async function addNewProduct(productData) {
  try {
    const formData = new FormData();
    formData.append('sellerId', String(currentUser.id));
    formData.append('name', productData.name);
    formData.append('categoryId', String(productData.categoryId));
    formData.append('description', productData.description || '');
    formData.append('price', String(productData.price));
    formData.append('inventory', String(productData.inventory));
    formData.append('deliveryEstimateDays', String(productData.deliveryEstimateDays));
    if (productData.imageFile) {
      formData.append('image', productData.imageFile);
    }

    const response = await fetch(`${API_BASE}/seller/products`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    showAlert('Product added successfully', 'success');
    await loadProducts();
    renderProducts();
    renderDashboard();
    return true;
  } catch (error) {
    console.error('Failed to add product:', error);
    showAlert('Failed to add product: ' + error.message, 'error');
    return false;
  }
}

async function rateBuyer(orderId, buyerId, rating, comment = '') {
  try {
    const response = await fetch(`${API_BASE}/seller/ratings/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        buyerId,
        sellerId: currentUser.id,
        rating,
        comment
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    showAlert('Buyer rated successfully', 'success');
    await loadOrders();
    renderOrders();
    return true;
  } catch (error) {
    console.error('Failed to rate buyer:', error);
    showAlert('Failed to rate buyer: ' + error.message, 'error');
    return false;
  }
}

async function submitBuyerRating(orderId, buyerId) {
  const ratingSelect = document.getElementById(`buyerRating-${orderId}`);
  const commentInput = document.getElementById(`buyerRatingComment-${orderId}`);
  if (!ratingSelect) return;

  const rating = Number(ratingSelect.value);
  const comment = commentInput ? commentInput.value.trim() : '';
  if (!rating || rating < 1 || rating > 5) {
    showAlert('Please select a rating between 1 and 5', 'error');
    return;
  }

  await rateBuyer(orderId, buyerId, rating, comment);
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`${API_BASE}/seller/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerId: currentUser.id,
        status: newStatus
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    showAlert('Order status updated', 'success');
    await loadOrders();
    renderOrders();
    renderDashboard();
    return true;
  } catch (error) {
    console.error('Failed to update order status:', error);
    showAlert('Failed to update order status: ' + error.message, 'error');
    return false;
  }
}

// ==================== Dashboard ====================
function renderDashboard() {
  const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const sellerRating = currentUser.rating || 4.5;
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const ordersThisWeek = allOrders.filter(o => {
    if (!o.created_at) return false;
    const orderDate = new Date(o.created_at);
    return !Number.isNaN(orderDate.getTime()) && orderDate >= oneWeekAgo;
  }).length;

  let productsSoldThisWeek = 0;
  allOrders.forEach(order => {
    if (!order.created_at) return;
    const orderDate = new Date(order.created_at);
    if (!Number.isNaN(orderDate.getTime()) && orderDate >= oneWeekAgo) {
      productsSoldThisWeek++;
    }
  });

  document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toFixed(2);
  document.getElementById('sellerRating').textContent = (sellerRating || 0).toFixed(1) + ' ★';
  document.getElementById('ordersThisWeek').textContent = ordersThisWeek;
  document.getElementById('productsSold').textContent = productsSoldThisWeek;

  const recentOrders = allOrders.slice(0, 5);
  const recentContainer = document.getElementById('recentOrdersContainer');
  
  if (recentOrders.length === 0) {
    recentContainer.innerHTML = '<div class="empty-message"><div class="empty-message-icon">📭</div><p>No orders yet</p></div>';
    return;
  }

  recentContainer.innerHTML = recentOrders.map(order => {
    const dateText = order.created_at
      ? new Date(order.created_at).toLocaleDateString()
      : 'Date unavailable';
    return `
    <div class="order-card">
      <div class="order-info">
        <h3>Order #${order.id}</h3>
        <div class="order-meta">
          Customer: ${order.buyer_name || 'Unknown'} • ${dateText}
        </div>
      </div>
      <span class="status-badge status-${(order.status || 'pending').toLowerCase()}">
        ${order.status || 'Pending'}
      </span>
      <div style="font-weight: 600; color: var(--accent-strong);">$${(order.total_amount || 0).toFixed(2)}</div>
    </div>
  `;
  }).join('');
}

// ==================== Products Management ====================
function renderCategoryFilters() {
  const filterContainer = document.getElementById('categoryFilters');
  filterContainer.innerHTML = '';

  const categories = [...new Set(allProducts.map(p => p.category))].sort();

  categories.forEach(category => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = category;
    btn.onclick = () => filterByCategory(category);
    filterContainer.appendChild(btn);
  });
}

function filterByCategory(category) {
  currentFilter = category;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === 'All Products' && category === 'all') {
      btn.classList.add('active');
    } else if (btn.textContent === category) {
      btn.classList.add('active');
    }
  });

  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('productsContainer');
  container.innerHTML = '';

  if (allProducts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>No products yet</h3>
        <p>Click "Add New Product" to create your first listing</p>
      </div>
    `;
    return;
  }

  const grouped = {};
  allProducts.forEach(product => {
    if (currentFilter !== 'all' && product.category !== currentFilter) {
      return;
    }

    const category = product.category || 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(product);
  });

  Object.keys(grouped).sort().forEach(category => {
    const section = document.createElement('div');
    section.className = 'category-section';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <h2>${category}</h2>
      <span class="product-count">${grouped[category].length} product${grouped[category].length !== 1 ? 's' : ''}</span>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'products-grid';

    grouped[category].forEach(product => {
      grid.appendChild(createProductCard(product));
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';

  const discountedPrice = product.price * (1 - product.discountPercentage / 100);
  const hasDiscount = product.discountPercentage > 0;

  let priceHtml = `<div class="product-price">$${product.price.toFixed(2)}</div>`;
  if (hasDiscount) {
    priceHtml = `
      <div class="product-price discounted">
        <span class="original-price">$${product.price.toFixed(2)}</span>
        <span>$${discountedPrice.toFixed(2)}</span>
        <span class="discount-badge">-${product.discountPercentage}%</span>
      </div>
    `;
  }

  const stockPercent = (product.inventory / Math.max(1, product.inventory + 10)) * 100;
  let stockClass = 'stock-fill';
  let stockStatus = 'In Stock';
  if (product.inventory < 5) {
    stockClass += ' critical';
    stockStatus = 'Low Stock';
  } else if (product.inventory < 20) {
    stockClass += ' low';
    stockStatus = 'Limited Stock';
  }

  card.innerHTML = `
    <div class="product-image">
      ${product.image ? `<img src="${product.image}" alt="${product.name}">` : '📦'}
    </div>
    <div class="product-info">
      <div class="product-name">${product.name}</div>
      <div class="product-meta">
        <span class="meta-badge">⭐ ${product.rating.toFixed(1)}</span>
        <span class="meta-badge">📦 ${product.orders} orders</span>
      </div>
      ${priceHtml}
      <div class="product-stock">
        <div class="stock-indicator">
          <div class="${stockClass}" style="width: ${Math.min(100, stockPercent)}%"></div>
        </div>
        <span>${product.inventory} units • ${stockStatus}</span>
      </div>
      <div class="product-actions">
        <button class="btn-edit" onclick="openEditModal(${product.id})">Edit</button>
        <button class="btn-delete" onclick="deleteProduct(${product.id})">Delete</button>
      </div>
    </div>
  `;

  return card;
}

// ==================== Orders Management ====================
function renderOrders() {
  const container = document.getElementById('ordersContainer');
  
  if (allOrders.length === 0) {
    container.innerHTML = '<div class="empty-message"><div class="empty-message-icon">📭</div><p>No orders yet</p></div>';
    return;
  }

  container.innerHTML = allOrders.map(order => {
    const buyerName = order.buyer_name || 'Unknown';
    const dateText = order.created_at
      ? new Date(order.created_at).toLocaleDateString()
      : 'Date unavailable';
    const buyerId = order.buyer_id ?? 'null';
    const buyerRating = Number(order.buyer_rating || 0);
    const selectedRating = buyerRating >= 1 && buyerRating <= 5 ? buyerRating : '';
    const ratingComment = escapeHtmlAttr(order.buyer_rating_comment || '');
    return `
    <div class="order-card">
      <div class="order-info">
        <h3>Order #${order.id}</h3>
        <div class="order-meta">
          <strong>Customer:</strong> ${buyerName}<br>
          <strong>Date:</strong> ${dateText}<br>
          <strong>Total:</strong> $${(order.total_amount || 0).toFixed(2)}
        </div>
      </div>
      <select class="order-status-select" onchange="updateOrderStatus(${order.id}, this.value)">
        <option value="Placed" ${order.status === 'Placed' ? 'selected' : ''}>Placed</option>
        <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
        <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
        <option value="Shipping" ${order.status === 'Shipping' ? 'selected' : ''}>Shipping</option>
        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
      <select class="order-status-select" id="buyerRating-${order.id}">
        <option value="" ${selectedRating === '' ? 'selected' : ''}>Rate buyer...</option>
        <option value="1" ${selectedRating === 1 ? 'selected' : ''}>1 - Poor</option>
        <option value="2" ${selectedRating === 2 ? 'selected' : ''}>2 - Fair</option>
        <option value="3" ${selectedRating === 3 ? 'selected' : ''}>3 - Good</option>
        <option value="4" ${selectedRating === 4 ? 'selected' : ''}>4 - Very Good</option>
        <option value="5" ${selectedRating === 5 ? 'selected' : ''}>5 - Excellent</option>
      </select>
      <input class="order-status-select" id="buyerRatingComment-${order.id}" placeholder="Optional rating note" value="${ratingComment}">
      <button class="btn-edit" onclick="submitBuyerRating(${order.id}, ${buyerId})">Save Buyer Rating</button>
      <button class="btn-flag" onclick="openFlagModal(${order.id}, ${buyerId})">Flag Buyer</button>
    </div>
  `;
  }).join('');
}

// ==================== Profile Management ====================
async function saveProfile(e) {
  e.preventDefault();
  
  currentUser.businessName = document.getElementById('profileBusinessName').value;
  currentUser.name = document.getElementById('profileOwnerName').value;
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  document.getElementById('businessName').textContent = currentUser.businessName;
  
  showAlert('Profile updated successfully', 'success');
}

// ==================== Buyer Flagging ====================
async function flagBuyer(orderId, buyerId, reason, details) {
  try {
    const response = await fetch(`${API_BASE}/seller/flags/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        buyerId,
        sellerId: currentUser.id,
        reason,
        details
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    showAlert('Buyer flagged successfully', 'success');
    closeFlagModal();
    return true;
  } catch (error) {
    console.error('Failed to flag buyer:', error);
    showAlert('Failed to flag buyer: ' + error.message, 'error');
    return false;
  }
}

function openFlagModal(orderId, buyerId) {
  const selectedOrder = allOrders.find((o) => o.id === orderId);
  const buyerName = selectedOrder?.buyer_name || 'Unknown';
  currentFlagOrderId = orderId;
  currentFlagBuyerId = buyerId;
  currentFlagBuyerName = buyerName;
  
  document.getElementById('flagBuyerName').value = buyerName;
  document.getElementById('flagReason').value = '';
  document.getElementById('flagDetails').value = '';
  
  document.getElementById('flagModal').classList.add('active');
}

function closeFlagModal() {
  document.getElementById('flagModal').classList.remove('active');
  currentFlagOrderId = null;
  currentFlagBuyerId = null;
  currentFlagBuyerName = null;
}

async function submitFlagBuyer(e) {
  e.preventDefault();
  
  const reason = document.getElementById('flagReason').value;
  const details = document.getElementById('flagDetails').value;
  
  const success = await flagBuyer(currentFlagOrderId, currentFlagBuyerId, reason, details);
  if (success) {
    document.getElementById('flagForm').reset();
  }
}

// ==================== Modal Functions ====================
function showAddProductModal() {
  document.getElementById('addModal').classList.add('active');
}

function closeAddProductModal() {
  document.getElementById('addModal').classList.remove('active');
  document.getElementById('addForm').reset();
}

async function openEditModal(productId) {
  currentEditProductId = productId;
  const product = await getProductDetails(productId);
  
  if (!product) return;

  document.getElementById('editName').value = product.name;
  document.getElementById('editDescription').value = product.description;
  document.getElementById('editPrice').value = product.price;
  document.getElementById('editDiscount').value = product.discountPercentage;
  document.getElementById('editQuantity').value = product.quantity;
  document.getElementById('editDeliveryDays').value = product.deliveryEstimateDays;
  document.getElementById('editCategory').value = product.categoryId;
  document.getElementById('editImageFile').value = '';

  document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  currentEditProductId = null;
}

async function deleteCurrentProduct() {
  if (currentEditProductId === null) {
    return;
  }
  await deleteProduct(currentEditProductId);
  closeEditModal();
}

// ==================== Form Submission ====================
async function saveProductChanges(e) {
  e.preventDefault();

  const updates = new FormData();
  updates.append('sellerId', String(currentUser.id));
  updates.append('name', document.getElementById('editName').value);
  updates.append('description', document.getElementById('editDescription').value);
  updates.append('price', String(parseFloat(document.getElementById('editPrice').value)));
  updates.append('discountPercentage', String(parseFloat(document.getElementById('editDiscount').value) || 0));
  updates.append('quantity', String(parseInt(document.getElementById('editQuantity').value)));
  updates.append('deliveryEstimateDays', String(parseInt(document.getElementById('editDeliveryDays').value)));
  updates.append('categoryId', String(document.getElementById('editCategory').value || ''));

  const imageFileInput = document.getElementById('editImageFile');
  if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
    updates.append('image', imageFileInput.files[0]);
  }

  const success = await updateProduct(currentEditProductId, updates);
  if (success) {
    closeEditModal();
  }
}

async function submitNewProduct(e) {
  e.preventDefault();

  const productData = {
    name: document.getElementById('addName').value,
    categoryId: parseInt(document.getElementById('addCategory').value, 10),
    description: document.getElementById('addDescription').value,
    price: parseFloat(document.getElementById('addPrice').value),
    inventory: parseInt(document.getElementById('addQuantity').value),
    deliveryEstimateDays: parseInt(document.getElementById('addDeliveryDays').value),
    imageFile: document.getElementById('addImageFile').files[0] || null
  };

  const success = await addNewProduct(productData);
  if (success) {
    closeAddProductModal();
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/seller/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: currentUser.id })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    showAlert('Product deleted successfully', 'success');
    await loadProducts();
    renderProducts();
    renderDashboard();
  } catch (error) {
    console.error('Failed to delete product:', error);
    showAlert('Failed to delete product: ' + error.message, 'error');
  }
}

function normalizeImageUrl(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) {
    return image;
  }
  if (image.startsWith('/')) {
    return API_BASE.replace('/api', '') + image;
  }
  return image;
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================== Tab Navigation ====================
function switchTab(tabName) {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });

  document.getElementById(tabName + 'Section').classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase() === tabName.toLowerCase()) {
      btn.classList.add('active');
    }
  });
}

// ==================== Utility Functions ====================
function populateCategorySelects() {
  const selects = [
    document.getElementById('editCategory'),
    document.getElementById('addCategory')
  ];

  selects.forEach(select => {
    select.innerHTML = '<option value="">Select category...</option>';
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  });
}

function showAlert(message, type = 'success') {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert ${type}`;
  alert.textContent = message;
  container.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 4000);
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'Login.html';
}

// ==================== Initialize on Load ====================
document.addEventListener('DOMContentLoaded', initializePage);
