const express = require("express");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app_url = process.env.APP_URL + ":" + port || "http://localhost:5000";
const { sequelize } = require("./src/config/database");
const models = require("./src/models");
const logger = require("./src/config/logger");

/* routes import */
const languagesRoutes = require("./src/routes/languagesRoutes");
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const categoryRoutes = require("./src/routes/admin/category.routes");
const subCategoryRoutes = require("./src/routes/admin/subCategory.routes");
const merchantRoutes = require("./src/routes/Merchant/merchantAuthRoutes");
const adminMerchantRoutes = require("./src/routes/admin/merchant.routes");
const amenityRoutes = require("./src/routes/admin/amenity.routes");
const transportTypeRoutes = require("./src/routes/admin/transportType.routes");
const transportAgencyRoutes = require("./src/routes/admin/transportAgency.routes");
const localArtistTypeRoutes = require("./src/routes/admin/localArtistType.routes");
const localArtistRoutes = require("./src/routes/admin/localArtist.routes");
const customerHomeroutes = require("./src/routes/Customer/home.routes");
const adminPropertyRoutes = require("./src/routes/admin/property.routes");
const propertyRoutes = require("./src/routes/Merchant/property.routes");
const propertySettingRoutes = require("./src/routes/Merchant/propertySetting.routes");
const unitRoutes = require("./src/routes/Merchant/unit.routes");

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://slvista-admin.vercel.app",
      "https://slvista-test.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/v1/admins", adminRoutes);

// common and general routes
app.use("/api/v1", authRoutes);
app.use("/api/v1/languages", languagesRoutes);

// admin
app.use("/api/v1/admin/categories", categoryRoutes);
app.use("/api/v1/admin/subcategories", subCategoryRoutes);
app.use("/api/v1/admin", adminMerchantRoutes);
app.use("/api/v1/admin/transport-types", transportTypeRoutes);
app.use("/api/v1/admin/amenities", amenityRoutes);
app.use("/api/v1/admin/transport-agencies", transportAgencyRoutes);
app.use("/api/v1/admin/local-artist-types", localArtistTypeRoutes);
app.use("/api/v1/admin/local-artists", localArtistRoutes);
app.use("/api/v1/admin/properties", adminPropertyRoutes);

// merchnat routes
app.use("/api/v1/merchants", merchantRoutes);
app.use("/api/v1/merchants/properties", propertyRoutes);
app.use("/api/v1/merchants/property-settings", propertySettingRoutes);
app.use("/api/v1/merchants/units", unitRoutes);

// customer routes
app.use("/api/v1/customer/list", customerHomeroutes);

// 1st api
app.get("/", (req, res) => {
  res.send(`Welcome to Travel Vista API. Base URL: ${app_url}`);
});

// Sync database and start server
sequelize
  .sync({ alter : true }) // Auto-create or update tables
  .then(async () => {
    console.log("Models synchronized!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Database sync error:", err));
