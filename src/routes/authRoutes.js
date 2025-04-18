const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth/authController");
const { loginValidation } = require("../utils/validations/auth.validation");

// Admin authentication
router.post("/admin/login", loginValidation, authController.adminLogin);

// Merchant authentication
router.post("/merchant/login", loginValidation, authController.merchantLogin);

// Token refresh
router.post("/refresh", authController.refreshToken);

// Logout
router.post("/logout", authController.logout);

module.exports = router;
