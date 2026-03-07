// ---------- SCREENS ----------
const screens = document.querySelectorAll(".screen");
const navItems = document.querySelectorAll(".nav__item");

function showScreen(id) {
  screens.forEach(function (screen) {
    screen.classList.remove("active");
  });
  var target = document.getElementById(id);
  if (target) target.classList.add("active");
  navItems.forEach(function (item) {
    item.classList.toggle("active", item.getAttribute("data-screen") === id);
  });
}

navItems.forEach(function (item) {
  item.addEventListener("click", function (e) {
    e.preventDefault();
    var id = item.getAttribute("data-screen");
    if (id) showScreen(id);
  });
});

// ---------- PRODUCT SELECTION ----------
const productCards = document.querySelectorAll("#home .product-card");
const productDetailsTitle = document.querySelector(".product-details__title");
let selectedProduct = "";

productCards.forEach(function (card) {
  card.addEventListener("click", function () {
    selectedProduct = card.querySelector(".product-card__title").innerText;
    if (productDetailsTitle) productDetailsTitle.innerText = selectedProduct;
  });
});

// ---------- PLACE ORDER ----------
const placeOrderBtn = document.querySelector(".place-order-btn");
const ordersScreen = document.getElementById("orders");

if (placeOrderBtn && ordersScreen) {
  placeOrderBtn.addEventListener("click", function () {
    if (selectedProduct === "") {
      alert("Please select a product first");
      return;
    }
    var orderCard = document.createElement("article");
    orderCard.className = "order-card";
    orderCard.innerHTML =
      "<h2 class=\"order-card__title\">" + selectedProduct + "</h2>" +
      "<div class=\"order-status order-status--processing\">Processing</div>" +
      "<div class=\"comment-section\">" +
      "<textarea class=\"comment-box\" placeholder=\"Add a comment or review…\" rows=\"3\"></textarea>" +
      "<button type=\"button\" class=\"btn rate-btn\">Submit Comment</button>" +
      "</div>";
    ordersScreen.appendChild(orderCard);
    alert("Order placed successfully!");
    showScreen("orders");
  });
}

// ---------- RATE PRODUCT (delegation: any Submit Comment on orders) ----------
if (ordersScreen) {
  ordersScreen.addEventListener("click", function (e) {
    if (!e.target.classList.contains("rate-btn")) return;
    var orderCard = e.target.closest(".order-card");
    if (!orderCard) return;
    var productName = orderCard.querySelector(".order-card__title");
    var name = productName ? productName.innerText : "";
    var rating = prompt("Rate this product (1-5)", "5");
    if (rating !== null) {
      var n = parseInt(rating, 10);
      if (n >= 1 && n <= 5) {
        alert("Thanks for rating " + name);
      } else {
        alert("Please enter a number between 1 and 5");
      }
    }
  });
}

// ---------- SEARCH ----------
const searchInput = document.getElementById("product-search");
if (searchInput && productCards.length) {
  searchInput.addEventListener("keyup", function () {
    var value = searchInput.value.toLowerCase();
    productCards.forEach(function (card) {
      var titleEl = card.querySelector(".product-card__title");
      var title = titleEl ? titleEl.innerText.toLowerCase() : "";
      card.style.display = title.indexOf(value) !== -1 ? "block" : "none";
    });
  });
}
