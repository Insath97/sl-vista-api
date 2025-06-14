const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/unit.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create unit
router.post("/", uploadMiddleware, controller.createUnit);

module.exports = router;
