const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const propertiesController = require("../controllers/Merchant/property.controller");
const homestaycontroller = require("../controllers/Merchant/homestay.controller");
const validate = require("../utils/validations/homestay.validations");

router.get(
  "/properties/approved-dropdown",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  propertiesController.getApprovedPropertiesForDropdown
);

router.get(
  "/homestays",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]), // Accepts both roles
  validate.list,
  homestaycontroller.getAllHomeStays
);

router.get(
  "/homestays/:id",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  homestaycontroller.getHomeStayByIdForAdminAndMerchant
);

module.exports = router;
