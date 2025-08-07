const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const propertiesController = require("../controllers/Merchant/property.controller");
const homestaycontroller = require("../controllers/Merchant/homestay.controller");
const validate = require("../utils/validations/homestay.validations");

router.use(middleware.authenticate);

router.get(
  "/properties/approved-dropdown",
  propertiesController.getApprovedPropertiesForDropdown
);

router.get("/homestays", validate.list, homestaycontroller.getAllHomeStays);

router.get(
  "/homestays/:id",
  homestaycontroller.getHomeStayByIdForAdminAndMerchant
);

module.exports = router;
