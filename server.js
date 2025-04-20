const express = require("express");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app_url = process.env.APP_URL + ":" + port || "http://localhost:5000";
const { sequelize } = require("./src/config/database");
const models = require("./src/models");
const logger = require("./src/config/logger");
const languagesRoutes = require("./src/routes/languagesRoutes");
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const subcategory = require("./src/routes/subCategoryRoutes");
const merchantRoutes = require("./src/routes/Merchant/merchantAuthRoutes");
const adminMerchantRoutes = require("./src/routes/admin/merchant.routes");

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "https://slvista-test.vercel.app/en", credentials: true }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/v1/languages", languagesRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1/admins", adminRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/subcategories", subcategory);
app.use("/api/v1/admin",adminMerchantRoutes);

// merchnat routes
app.use("/api/v1/merchants", merchantRoutes);


// 1st api
app.get("/", (req, res) => {
  res.send(`Welcome to Travel Vista API. Base URL: ${app_url}`);
});

// Sync database and start server
sequelize
  .sync({ alter: true }) // Auto-create or update tables
  .then(async () => {
    console.log("Models synchronized!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Database sync error:", err));
