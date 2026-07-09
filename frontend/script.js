const API_BASE = "https://smartcart-backend-dqi2.onrender.com";
const productGrid = document.getElementById("productGrid");
const ordersList = document.getElementById("ordersList");
const healthOutput = document.getElementById("healthOutput");
const totalProducts = document.getElementById("totalProducts");
const totalOrders = document.getElementById("totalOrders");
const totalRevenue = document.getElementById("totalRevenue");
const totalStock = document.getElementById("totalStock");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userBox = document.getElementById("userBox");
const adminPanel = document.getElementById("adminPanel");
const authModal = document.getElementById("authModal");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authForm = document.getElementById("authForm");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const productForm = document.getElementById("productForm");
const paymentModal = document.getElementById("paymentModal");
const paymentForm = document.getElementById("paymentForm");
const paymentTitle = document.getElementById("paymentTitle");
const paymentAmount = document.getElementById("paymentAmount");
const paymentMethod = document.getElementById("paymentMethod");
const upiBox = document.getElementById("upiBox");
const cardBox = document.getElementById("cardBox");
const paymentMessage = document.getElementById("paymentMessage");
const paymentNote = document.getElementById("paymentNote");

let authMode = "login";
let currentUser = JSON.parse(localStorage.getItem("smartcart_user") || "null");
let token = localStorage.getItem("smartcart_token") || "";
let selectedProduct = null;
const trackingSteps = ["Order Placed", "Packed", "Shipped", "Out for Delivery", "Delivered"];

const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const escapeText = (value = "") => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function formatDate(value) {
  if (!value) return "Not assigned";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function clearSession(showLoginMessage = false) {
  token = "";
  currentUser = null;
  localStorage.removeItem("smartcart_token");
  localStorage.removeItem("smartcart_user");
  updateAuthUI();
  if (showLoginMessage) {
    openAuth("login");
    authMessage.textContent = "Session expired. Please login again.";
  }
}

async function fetchJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${url}`, {
  ...options,
  headers
});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register")) {
      clearSession(true);
    }
    throw new Error(data.message || "Request failed");
  }
  return data;
}

async function verifySavedSession() {
  if (!token) return;
  try {
    const data = await fetchJson("/api/auth/me");
    currentUser = data.user;
    localStorage.setItem("smartcart_user", JSON.stringify(currentUser));
  } catch (_) {
    clearSession(false);
  }
}

function updateAuthUI() {
  if (currentUser && token) {
    loginBtn.classList.add("hidden");
    registerBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userBox.classList.remove("hidden");
    userBox.innerHTML = `<strong>${escapeText(currentUser.name)}</strong><span>${escapeText(currentUser.role)}</span>`;
    adminPanel.classList.toggle("hidden", currentUser.role !== "admin");
  } else {
    loginBtn.classList.remove("hidden");
    registerBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userBox.classList.add("hidden");
    adminPanel.classList.add("hidden");
  }
}

function openAuth(mode) {
  authMode = mode;
  authMessage.textContent = "";
  authForm.reset();
  nameInput.classList.toggle("hidden", mode === "login");
  authTitle.textContent = mode === "login" ? "Login" : "Create Account";
  authSubtitle.textContent = mode === "login" ? "Access your SmartCart account" : "Register and start ordering";
  authSubmit.textContent = mode === "login" ? "Login" : "Register";
  authModal.classList.remove("hidden");
}

function closeAuth() {
  authModal.classList.add("hidden");
}

function logout() {
  clearSession(false);
  loadEverything();
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    authSubmit.disabled = true;
    authMessage.textContent = "Please wait...";
    const body = authMode === "login"
      ? { email: emailInput.value.trim(), password: passwordInput.value }
      : { name: nameInput.value.trim(), email: emailInput.value.trim(), password: passwordInput.value };
    const data = await fetchJson(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify(body) });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem("smartcart_token", token);
    localStorage.setItem("smartcart_user", JSON.stringify(currentUser));
    closeAuth();
    updateAuthUI();
    await loadEverything();
  } catch (error) {
    authMessage.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const body = {
      name: document.getElementById("pName").value.trim(),
      category: document.getElementById("pCategory").value.trim(),
      price: Number(document.getElementById("pPrice").value),
      stock: Number(document.getElementById("pStock").value),
      image: document.getElementById("pImage").value.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
      badge: "Admin Added"
    };
    await fetchJson("/api/products", { method: "POST", body: JSON.stringify(body) });
    productForm.reset();
    await loadEverything();
  } catch (error) {
    alert(error.message);
  }
});

async function checkBackend() {
  try {
    const data = await fetchJson("/api/health");
    healthOutput.textContent = JSON.stringify(data, null, 2);
  } catch (_) {
    healthOutput.textContent = "Backend health check failed.";
  }
}

async function loadProducts() {
  try {
    productGrid.innerHTML = '<div class="empty">Loading premium products...</div>';
    const data = await fetchJson("/api/products");
    productGrid.innerHTML = "";

    data.products.forEach((product) => {
      const safeProduct = {
        _id: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
        rating: product.rating,
        stock: product.stock,
        image: product.image,
        badge: product.badge
      };
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-image" style="background-image: url('${escapeText(product.image)}')">
          <span class="product-badge">${escapeText(product.badge || "New")}</span>
        </div>
        <div class="product-body">
          <h3>${escapeText(product.name)}</h3>
          <div class="product-meta">${escapeText(product.category)} • ⭐ ${product.rating || 4.5} • Stock ${product.stock}</div>
          <div class="product-row">
            <span class="price">${formatCurrency(product.price)}</span>
            <button onclick='openPayment(${JSON.stringify(safeProduct).replace(/'/g, "&#39;")})' ${product.stock <= 0 ? "disabled" : ""}>Pay & Buy</button>
          </div>
          ${currentUser?.role === "admin" ? `<button class="delete-btn" onclick="deleteProduct('${product._id}')">Delete</button>` : ""}
        </div>`;
      productGrid.appendChild(card);
    });
  } catch (error) {
    productGrid.innerHTML = `<div class="error">Products could not be loaded. ${escapeText(error.message)}</div>`;
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await fetchJson(`/api/products/${id}`, { method: "DELETE" });
    await loadEverything();
  } catch (error) {
    alert(error.message);
  }
}

function openPayment(product) {
  if (!token || !currentUser) {
    openAuth("login");
    authMessage.textContent = "Please login before payment.";
    return;
  }
  selectedProduct = product;
  paymentForm.reset();
  paymentMessage.textContent = "";
  paymentTitle.textContent = `Payment for ${product.name}`;
  paymentAmount.textContent = formatCurrency(product.price);
  paymentNote.textContent = "Demo payment only. No real money will be charged.";
  togglePaymentFields();
  paymentModal.classList.remove("hidden");
}

function closePayment() {
  paymentModal.classList.add("hidden");
  selectedProduct = null;
}

function togglePaymentFields() {
  const method = paymentMethod.value;
  upiBox.classList.toggle("hidden", method !== "UPI");
  cardBox.classList.toggle("hidden", method !== "CARD");
}

paymentMethod.addEventListener("change", togglePaymentFields);

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedProduct) return;

  try {
    paymentForm.querySelector("button").disabled = true;
    paymentMessage.textContent = "Processing secure demo checkout...";
    const method = paymentMethod.value;
    const data = await fetchJson("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        productId: selectedProduct._id,
        quantity: 1,
        method,
        upiId: document.getElementById("upiId").value.trim(),
        cardNumber: document.getElementById("cardNumber").value.trim()
      })
    });

    paymentMessage.textContent = `${data.message} | Transaction: ${data.payment.transactionId}`;
    setTimeout(closePayment, 1000);
    await loadEverything();
  } catch (error) {
    paymentMessage.textContent = error.message;
  } finally {
    paymentForm.querySelector("button").disabled = false;
  }
});

function trackingHtml(order) {
  const status = order.trackingStatus || "Order Placed";
  const activeIndex = trackingSteps.indexOf(status);
  const cancelled = status === "Cancelled";
  const steps = trackingSteps.map((step, index) => {
    const active = !cancelled && index <= activeIndex ? "active" : "";
    return `<div class="track-step ${active}"><span>${index + 1}</span><small>${escapeText(step)}</small></div>`;
  }).join("");
  return `<div class="tracking-box">
    <div class="tracking-top"><strong>${escapeText(status)}</strong><span>${escapeText(order.trackingId || "Tracking pending")}</span></div>
    <div class="tracking-steps ${cancelled ? "cancelled" : ""}">${steps}</div>
    <p><strong>Estimated Delivery:</strong> ${formatDate(order.estimatedDelivery)}</p>
    ${cancelled ? `<p class="tracking-cancelled">Order Cancelled</p>` : ""}
  </div>`;
}

async function updateTracking(orderId) {
  const status = prompt("Enter status exactly: Order Placed, Packed, Shipped, Out for Delivery, Delivered, Cancelled");
  if (!status) return;
  const note = prompt("Add tracking note", `Status updated to ${status}`) || `Status updated to ${status}`;
  try {
    await fetchJson(`/api/orders/${orderId}/tracking`, { method: "PATCH", body: JSON.stringify({ status, note }) });
    await loadOrders();
    await loadAnalytics();
  } catch (error) {
    alert(error.message);
  }
}

async function viewTracking(orderId) {
  try {
    const data = await fetchJson(`/api/orders/${orderId}/tracking`);
    const history = data.tracking.history.map((h) => `${formatDate(h.time)} - ${h.status}: ${h.note}`).join("\n");
    alert(`Tracking ID: ${data.tracking.trackingId}\nStatus: ${data.tracking.status}\nEstimated Delivery: ${formatDate(data.tracking.estimatedDelivery)}\n\nHistory:\n${history}`);
  } catch (error) {
    alert(error.message);
  }
}

async function loadOrders() {
  if (!token) {
    ordersList.innerHTML = '<div class="empty">Login to view your orders and payments.</div>';
    return;
  }
  try {
    const data = await fetchJson("/api/orders");
    if (!data.orders.length) {
      ordersList.innerHTML = '<div class="empty">No orders yet. Click Pay & Buy.</div>';
      return;
    }
    ordersList.innerHTML = "";
    data.orders.slice(0, 12).forEach((order) => {
      const item = document.createElement("div");
      item.className = "order-item";
      item.innerHTML = `
        <h3>${escapeText(order.productName)}</h3>
        <p><strong>Customer:</strong> ${escapeText(order.customerName)}</p>
        <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
        <p><strong>Payment:</strong> ${escapeText(order.paymentMethod || "N/A")} • ${escapeText(order.paymentStatus || "pending")}</p>
        <p><strong>Txn:</strong> ${escapeText(order.paymentId || "DIRECT")}</p>
        ${trackingHtml(order)}
        <div class="order-actions">
          <button onclick="viewTracking('${order._id}')">View Tracking</button>
          ${currentUser?.role === "admin" ? `<button class="ghost-mini" onclick="updateTracking('${order._id}')">Update Status</button>` : ""}
        </div>`;
      ordersList.appendChild(item);
    });
  } catch (error) {
    ordersList.innerHTML = `<div class="error">Orders could not be loaded. ${escapeText(error.message)}</div>`;
  }
}

async function loadAnalytics() {
  try {
    const data = await fetchJson("/api/analytics");
    totalProducts.textContent = data.stats.totalProducts;
    totalOrders.textContent = data.stats.totalOrders;
    totalRevenue.textContent = formatCurrency(data.stats.totalRevenue);
    totalStock.textContent = data.stats.totalStock;
  } catch (_) {
    totalProducts.textContent = "-";
    totalOrders.textContent = "-";
    totalRevenue.textContent = "-";
    totalStock.textContent = "-";
  }
}

async function loadEverything() {
  updateAuthUI();
  await Promise.all([loadProducts(), loadOrders(), loadAnalytics()]);
}

(async function init() {
  await verifySavedSession();
  updateAuthUI();
  await loadEverything();
})();
