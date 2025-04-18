const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const adminAuthController = require("../controllers/adminAuthController");

// Authentication Routes
router.post("/login", adminAuthController.loginAdmin);
router.post("/logout", adminAuthController.logoutAdmin);
router.post("/refresh-token", adminAuthController.refreshToken);

module.exports = router;