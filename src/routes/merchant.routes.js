const express = require("express");
const router = express.Router();
const controller = require("../controllers/merchant.controller");
const validate = require("../utils/validations/merchant.validation");
const middleware = require("../middlewares/auth.middleware");

/* public routes */
router.post(
  "/merchant/register",
  validate.createMerchantValidation,
  controller.registerMerchant
);

router.use(middleware.authenticate);

/* list all merchants */
router.get(
  "/merchants",
  validate.listMerchantsValidation,
  controller.listMerchants
);

/* approved merchant */
router.patch(
  "/merchant/:id/approve",
  validate.approveMerchantValidation,
  controller.approveMerchant
);

/* rejected merchant */
router.patch(
  "/merchant/:id/reject",
  validate.rejectMerchantValidation,
  controller.rejectMerchant
);

/* update status */
router.patch(
  "/merchant/:id/status",
  validate.updateMerchantStatusValidation,
  controller.updateMerchantStatus
);

/* update admin and update profile */
router.put(
  "/merchant/:id",
  validate.updateMerchantValidation,
  controller.updateMerchant
);

/* delete */
router.delete(
  "/merchant/:id",
  validate.deleteMerchantValidation,
  controller.deleteMerchant
);

/* restore */
router.patch(
  "/merchant/:id/restore",
  validate.restoreMerchantValidation,
  controller.restoreMerchant
);

module.exports = router;
