const express = require("express");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app_url = process.env.APP_URL + ":" + port || "http://localhost:5000";
const { sequelize } = require("./src/config/database");
const models = require("./src/models");
/* const logger = require("./src/config/logger"); */

/* routes import */
const languagesRoutes = require("./src/routes/languagesRoutes");
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const merchantRoutes = require("./src/routes/Merchant/merchantAuthRoutes");
const adminMerchantRoutes = require("./src/routes/admin/merchant.routes");
const amenityRoutes = require("./src/routes/admin/amenity.routes");
const transportTypeRoutes = require("./src/routes/admin/transportType.routes");
const transportAgencyRoutes = require("./src/routes/admin/transportAgency.routes");
const shopping = require("./src/routes/admin/shopping.routes");
const foodAndBeverages = require("./src/routes/admin/foodAndBeverages.routes");
const customerHomeroutes = require("./src/routes/Customer/home.routes");
const adminPropertyRoutes = require("./src/routes/admin/property.routes");
const propertyRoutes = require("./src/routes/Merchant/property.routes");
const adminhHomestaysRoutes = require("./src/routes/admin/homestays.routes");
const propertySettingRoutes = require("./src/routes/Merchant/propertySetting.routes");
const homestayRoutes = require("./src/routes/Merchant/homestay.routes");
const customerRegistrationRoutes = require("./src/routes/Customer/customer.routes");
const customerListRoutes = require("./src/routes/admin/customerList.routes");
const commonRoutes = require("./src/routes/common.routes");
const bookingRoutes = require("./src/routes/booking.routes");
const permissionRoutes = require("./src/routes/permission.routes");
const roomtypeRoutes = require("./src/routes/roomType.routes");
const roomRoutes = require("./src/routes/room.routes");

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

// In your Express app
app.use(express.json({ limit: "1024mb" }));
app.use(express.urlencoded({ limit: "1024mb", extended: true }));

// Add response timeout settings
app.use((req, res, next) => {
  res.setTimeout(300000, () => {
    // 5 minutes timeout
    console.error("Request timeout");
    res.status(504).json({ error: "Request timeout" });
  });
  next();
});

// Routes
app.use("/api/v1/admins", adminRoutes);

// common and general routes
app.use("/api/v1", authRoutes);
app.use("/api/v1/languages", languagesRoutes);

// admin
app.use("/api/v1/admin", adminMerchantRoutes);
app.use("/api/v1/admin/transport-types", transportTypeRoutes);
app.use("/api/v1/admin/amenities", amenityRoutes);
app.use("/api/v1/admin/transport-agencies", transportAgencyRoutes);
app.use("/api/v1/admin/shopping", shopping);
app.use("/api/v1/admin/food-and-beverages", foodAndBeverages);
app.use("/api/v1/admin/properties", adminPropertyRoutes);
app.use("/api/v1/admin/homestays", adminhHomestaysRoutes);
app.use("/api/v1/admin/customers", customerListRoutes);
app.use("/api/v1/admin/permissions", permissionRoutes);

// merchant routes
app.use("/api/v1/merchants", merchantRoutes);
app.use("/api/v1/merchants/properties", propertyRoutes);
app.use("/api/v1/merchants/property-settings", propertySettingRoutes);
app.use("/api/v1/merchants/homestays", homestayRoutes);

// common routes
app.use("/api/v1", commonRoutes);
app.use("/api/v1/room-type", roomtypeRoutes);
/* app.use("/api/v1/rooms", roomRoutes);
 */
// customer routes
app.use("/api/v1/customer", customerRegistrationRoutes);
app.use("/api/v1/customer/list", customerHomeroutes);
app.use("/api/v1/booking", bookingRoutes);

// 1st api
app.get("/", (req, res) => {
  res.send(`Welcome to Travel Vista API. Base URL: ${app_url}`);
});

// Sync database and start server
sequelize
  .sync(/* { force: true } */) // Auto-create or update tables
  .then(async () => {
    console.log("Models synchronized!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Database sync error:", err));
