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
const customerRoutes = require("./src/routes/customer.routes");
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const amenityRoutes = require("./src/routes/admin/amenity.routes");
const transportTypeRoutes = require("./src/routes/admin/transportType.routes");
const transportAgencyRoutes = require("./src/routes/admin/transportAgency.routes");
const shopping = require("./src/routes/admin/shopping.routes");
const foodAndBeverages = require("./src/routes/admin/foodAndBeverages.routes");
const events = require("./src/routes/admin/events.routes");
const activites = require("./src/routes/admin/activities.routes");
const guidesRoutes = require("./src/routes/admin/guides.routes");
const localArtistsType = require("./src/routes/admin/localAritstsType.routes");
const localArtistRoutes = require("./src/routes/admin/localArtists.routes");
const merchantRoutes = require("./src/routes/merchant.routes");
const propertyRoutes = require("./src/routes/property.routes");
const roomtypeRoutes = require("./src/routes/roomType.routes");
const roomRoutes = require("./src/routes/room.routes");
const homestaysRoutes = require("./src/routes/homestay.routes");

const bookingRoutes = require("./src/routes/booking.routes");
const permissionRoutes = require("./src/routes/permission.routes");
const roleRoutes = require("./src/routes/roles.routes");
const userRoutes = require("./src/routes/user.routes");



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

/*
  ======================
   Route Configuration
  ====================== 
*/
app.use("/api/v1/admins", adminRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/languages", languagesRoutes);
app.use("/api/v1/amenities", amenityRoutes);
app.use("/api/v1/transport-types", transportTypeRoutes);
app.use("/api/v1/transport-agencies", transportAgencyRoutes);
app.use("/api/v1/artist-type", localArtistsType);
app.use("/api/v1/local-artists", localArtistRoutes);
app.use("/api/v1/activities", activites);
app.use("/api/v1/events", events);
app.use("/api/v1/guides", guidesRoutes);
app.use("/api/v1/shopping", shopping);
app.use("/api/v1/food-and-beverages", foodAndBeverages);
app.use("/api/v1/merchant", merchantRoutes);
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1/room-type", roomtypeRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/homestays", homestaysRoutes);

// 1st api
app.get("/", (req, res) => {
  res.send(`Welcome to Travel Vista API. Base URL: ${app_url}`);
});

// admin
app.use("/api/v1/admin/permissions", permissionRoutes);
app.use("/api/v1/admin/roles", roleRoutes);
app.use("/api/v1/admin/users", userRoutes);

/* customer routes */
app.use("/api/v1/booking", bookingRoutes);

// Sync database and start server
sequelize
  .sync({
/*     alter: true, */
  }) // Auto-create or update tables
  .then(async () => {
    console.log("Models synchronized!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Database sync error:", err));
