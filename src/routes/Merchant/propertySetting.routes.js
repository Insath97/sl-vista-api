const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/propertySetting.controller");
const validate = require("../../utils/validations/propertySetting.validation");
const middleware = require("../../middlewares/auth.middleware");

// Apply authentication middleware to all routes
router.use(middleware.authMiddlewareWithProfile("merchant"));

// Create property settings
router.post(
  "/properties/:propertyId/settings",
  validate.create,
  controller.createPropertySetting
);



module.exports = router;