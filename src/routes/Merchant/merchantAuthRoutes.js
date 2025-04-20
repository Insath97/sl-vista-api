const express = require("express");
const router = express.Router();
const MerchantAuthController = require("../../controllers/Merchant/merchantAuthController");
const MerchantValidation = require("../../utils/validations/merchantValidation");

router.post(
  "/register",
  MerchantValidation.createMerchantValidation,
  MerchantAuthController.registerMerchant
);

module.exports = router;
