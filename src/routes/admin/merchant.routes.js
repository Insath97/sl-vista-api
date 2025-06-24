const express = require("express");
const router = express.Router();
const merchantController = require("../../controllers/admin/merchantController");
const MerchantValidation = require("../../utils/validations/merchantValidation");
const middleware = require("../../middlewares/authMiddleware");

router.use(middleware.authMiddlewareWithProfile("admin"));

router.get(
  "/merchants",
  MerchantValidation.listMerchantsValidation,
  merchantController.listMerchants
);

module.exports = router;