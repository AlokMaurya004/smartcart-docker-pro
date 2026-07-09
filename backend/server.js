const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.error("MongoDB connection error:", error.message));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "customer"], default: "customer" }
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    price: Number,
    rating: Number,
    stock: Number,
    image: String,
    badge: String
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    customerName: String,
    productName: String,
    price: Number,
    quantity: Number,
    total: Number,
    paymentId: String,
    paymentMethod: String,
    paymentStatus: { type: String, enum: ["paid", "pending", "failed"], default: "pending" },
    trackingId: { type: String, unique: true, sparse: true },
    trackingStatus: { type: String, enum: ["Order Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"], default: "Order Placed" },
    shippingAddress: { type: String, default: "Demo Address, India" },
    estimatedDelivery: Date,
    trackingHistory: [{ status: String, note: String, time: { type: Date, default: Date.now } }]
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    customerName: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: String,
    amount: Number,
    quantity: Number,
    method: { type: String, enum: ["UPI", "CARD", "COD"], required: true },
    status: { type: String, enum: ["created", "paid", "pending", "failed"], default: "created" },
    transactionId: String,
    orderCreated: { type: Boolean, default: false },
    upiId: String,
    cardLast4: String
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);
const Payment = mongoose.model("Payment", paymentSchema);

const defaultProducts = [
  { name: "MacBook Air M3", category: "Laptop", price: 114900, rating: 4.8, stock: 12, image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80", badge: "Trending" },
  { name: "iPhone 15 Pro", category: "Smartphone", price: 129900, rating: 4.9, stock: 18, image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=80", badge: "Premium" },
  { name: "Sony WH-1000XM5", category: "Audio", price: 29990, rating: 4.7, stock: 25, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=900&q=80", badge: "Best Seller" },
  { name: "Apple Watch Ultra", category: "Wearable", price: 89900, rating: 4.6, stock: 10, image: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=900&q=80", badge: "New" },
  { name: "Gaming Keyboard RGB", category: "Accessories", price: 4999, rating: 4.5, stock: 40, image: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&w=900&q=80", badge: "Hot Deal" },
  { name: "Canon Mirrorless Camera", category: "Camera", price: 72999, rating: 4.6, stock: 8, image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80", badge: "Creator Pick" }
];

async function seedData() {
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany(defaultProducts);
    console.log("Default products inserted");
  }

  const adminEmail = "admin@smartcart.com";
  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await User.create({ name: "Admin", email: adminEmail, password: hashedPassword, role: "admin" });
    console.log("Default admin created: admin@smartcart.com / admin123");
  }
}

mongoose.connection.once("open", seedData);

function signToken(user) {
  return jwt.sign({ id: user._id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Login required" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

function makeTransactionId(method) {
  return `${method}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeTrackingId() {
  return `SCT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function estimateDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date;
}

function defaultTrackingHistory(status = "Order Placed") {
  return [{ status, note: "Your order has been placed successfully.", time: new Date() }];
}

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", service: "SmartCart Pro Backend", container: os.hostname(), time: new Date().toLocaleString() });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: "Account created successfully", token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Unable to register", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    res.json({ message: "Login successful", token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Unable to login", error: error.message });
  }
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ price: 1 });
    res.json({ container: os.hostname(), total: products.length, products });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch products", error: error.message });
  }
});

app.post("/api/products", auth, adminOnly, async (req, res) => {
  try {
    const { name, category, price, stock, rating, image, badge } = req.body;
    if (!name || !category || !price) return res.status(400).json({ message: "Name, category and price are required" });
    const product = await Product.create({ name, category, price, stock: stock || 0, rating: rating || 4.5, image, badge: badge || "New" });
    res.status(201).json({ message: "Product added", product });
  } catch (error) {
    res.status(500).json({ message: "Unable to add product", error: error.message });
  }
});

app.delete("/api/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete product", error: error.message });
  }
});



app.post("/api/checkout", auth, async (req, res) => {
  try {
    const { productId, quantity = 1, method = "COD", upiId, cardNumber, shippingAddress } = req.body;
    const qty = Math.max(1, Number(quantity) || 1);

    if (!productId) return res.status(400).json({ message: "Product is required" });
    if (!["UPI", "CARD", "COD"].includes(method)) return res.status(400).json({ message: "Invalid payment method" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < qty) return res.status(400).json({ message: "Not enough stock available" });

    if (method === "UPI" && !upiId) return res.status(400).json({ message: "Enter a demo UPI ID" });
    if (method === "CARD" && (!cardNumber || String(cardNumber).replace(/\s/g, "").length < 12)) {
      return res.status(400).json({ message: "Enter a valid demo card number" });
    }

    const total = product.price * qty;
    const transactionId = makeTransactionId(method);
    const paymentStatus = method === "COD" ? "pending" : "paid";

    const payment = await Payment.create({
      user: req.user._id,
      customerName: req.user.name,
      product: product._id,
      productName: product.name,
      amount: total,
      quantity: qty,
      method,
      status: paymentStatus,
      transactionId,
      orderCreated: true,
      upiId: method === "UPI" ? upiId : undefined,
      cardLast4: method === "CARD" ? String(cardNumber).replace(/\s/g, "").slice(-4) : undefined
    });

    product.stock -= qty;
    await product.save();

    const order = await Order.create({
      user: req.user._id,
      customerName: req.user.name,
      productName: product.name,
      price: product.price,
      quantity: qty,
      total,
      paymentId: transactionId,
      paymentMethod: method,
      paymentStatus,
      trackingId: makeTrackingId(),
      trackingStatus: "Order Placed",
      shippingAddress: shippingAddress || "Demo Address, India",
      estimatedDelivery: estimateDeliveryDate(),
      trackingHistory: defaultTrackingHistory()
    });

    res.status(201).json({
      message: method === "COD" ? "Order placed with Cash on Delivery" : "Payment successful and order placed",
      container: os.hostname(),
      payment,
      order,
      demoNote: "Demo payment only. No real money was charged."
    });
  } catch (error) {
    res.status(500).json({ message: "Checkout failed", error: error.message });
  }
});

app.post("/api/payments/create", auth, async (req, res) => {
  try {
    const { productId, quantity = 1, method } = req.body;
    if (!productId || !method) return res.status(400).json({ message: "Product and payment method are required" });
    if (!["UPI", "CARD", "COD"].includes(method)) return res.status(400).json({ message: "Invalid payment method" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < quantity) return res.status(400).json({ message: "Not enough stock available" });

    const payment = await Payment.create({
      user: req.user._id,
      customerName: req.user.name,
      product: product._id,
      productName: product.name,
      amount: product.price * quantity,
      quantity,
      method,
      status: method === "COD" ? "pending" : "created",
      transactionId: makeTransactionId(method)
    });

    res.status(201).json({
      message: method === "COD" ? "COD payment created" : "Payment created successfully",
      container: os.hostname(),
      payment,
      demoNote: "This is a demo payment system. No real money is charged."
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to create payment", error: error.message });
  }
});

app.post("/api/payments/:id/confirm", auth, async (req, res) => {
  try {
    const { upiId, cardNumber } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (String(payment.user) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });
    if (payment.orderCreated) {
      return res.status(400).json({ message: "Payment already processed" });
    }

    const product = await Product.findById(payment.product);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < payment.quantity) return res.status(400).json({ message: "Not enough stock available" });

    if (payment.method === "UPI" && !upiId) return res.status(400).json({ message: "UPI ID is required" });
    if (payment.method === "CARD" && (!cardNumber || String(cardNumber).replace(/\s/g, "").length < 12)) {
      return res.status(400).json({ message: "Valid demo card number is required" });
    }

    payment.status = payment.method === "COD" ? "pending" : "paid";
    payment.upiId = payment.method === "UPI" ? upiId : undefined;
    payment.cardLast4 = payment.method === "CARD" ? String(cardNumber).replace(/\s/g, "").slice(-4) : undefined;
    payment.orderCreated = true;
    await payment.save();

    product.stock -= payment.quantity;
    await product.save();

    const order = await Order.create({
      user: req.user._id,
      customerName: req.user.name,
      productName: payment.productName,
      price: payment.amount / payment.quantity,
      quantity: payment.quantity,
      total: payment.amount,
      paymentId: payment.transactionId,
      paymentMethod: payment.method,
      paymentStatus: payment.status,
      trackingId: makeTrackingId(),
      trackingStatus: "Order Placed",
      estimatedDelivery: estimateDeliveryDate(),
      trackingHistory: defaultTrackingHistory()
    });

    res.status(201).json({
      message: payment.method === "COD" ? "Order placed with Cash on Delivery" : "Payment successful and order placed",
      container: os.hostname(),
      payment,
      order
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to confirm payment", error: error.message });
  }
});

app.get("/api/payments", auth, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { user: req.user._id };
    const payments = await Payment.find(query).sort({ createdAt: -1 });
    res.json({ container: os.hostname(), total: payments.length, payments });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch payments", error: error.message });
  }
});

app.post("/api/orders", auth, async (req, res) => {
  try {
    const { productName, price, quantity } = req.body;
    if (!productName || !price || !quantity) return res.status(400).json({ message: "Product name, price and quantity are required" });

    const order = await Order.create({
      user: req.user._id,
      customerName: req.user.name,
      productName,
      price,
      quantity,
      total: price * quantity,
      paymentMethod: "DIRECT",
      paymentStatus: "paid",
      trackingId: makeTrackingId(),
      trackingStatus: "Order Placed",
      estimatedDelivery: estimateDeliveryDate(),
      trackingHistory: defaultTrackingHistory()
    });
    res.status(201).json({ message: "Order placed successfully", container: os.hostname(), order });
  } catch (error) {
    res.status(500).json({ message: "Unable to place order", error: error.message });
  }
});

app.get("/api/orders", auth, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { user: req.user._id };
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json({ container: os.hostname(), total: orders.length, orders });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch orders", error: error.message });
  }
});

app.get("/api/orders/:id/tracking", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.user) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });
    res.json({ container: os.hostname(), tracking: { orderId: order._id, trackingId: order.trackingId, productName: order.productName, customerName: order.customerName, status: order.trackingStatus, estimatedDelivery: order.estimatedDelivery, history: order.trackingHistory } });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch tracking", error: error.message });
  }
});

app.patch("/api/orders/:id/tracking", auth, adminOnly, async (req, res) => {
  try {
    const allowed = ["Order Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
    const { status, note } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid tracking status" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.trackingStatus = status;
    order.trackingHistory.push({ status, note: note || `Status updated to ${status}`, time: new Date() });
    await order.save();
    res.json({ message: "Tracking updated successfully", container: os.hostname(), order });
  } catch (error) {
    res.status(500).json({ message: "Unable to update tracking", error: error.message });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const products = await Product.find();
    const orders = await Order.find();
    const payments = await Payment.find();
    const paidPayments = payments.filter((payment) => payment.status === "paid");
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
    const categoryMap = {};
    products.forEach((product) => { categoryMap[product.category] = (categoryMap[product.category] || 0) + 1; });

    res.json({
      container: os.hostname(),
      stats: { totalProducts: products.length, totalOrders: orders.length, totalPayments: payments.length, paidPayments: paidPayments.length, totalRevenue, totalStock, categories: Object.keys(categoryMap).length },
      categoryMap
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch analytics", error: error.message });
  }
});

app.listen(PORT, () => console.log(`SmartCart Pro backend running on port ${PORT}`));
