const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth/authController");
const { loginValidation } = require("../utils/validations/auth.validation");

// Admin authentication
router.post("/admin/login", loginValidation, authController.adminLogin);

// Merchant authentication
router.post("/merchants/login", loginValidation, authController.merchantLogin);

/* common login for admin and merchant */
router.post("/login", loginValidation, authController.unifiedLogin);

// Customer authentication
router.post("/customer/login", loginValidation, authController.customerLogin);

// Token refresh
router.post("/refresh", authController.refreshToken);

// Logout
router.post("/logout", authController.logout);

module.exports = router;
