const express = require("express");
const router = express.Router();
const controller = require("../controllers/merchant.controller");
const validate = require("../utils/validations/merchant.validation");
const middleware = require("../middlewares/auth.middleware");

/* public routes */
router.post(
  "/register",
  validate.createMerchantValidation,
  controller.registerMerchant
);

router.use(middleware.authenticate);

/* list all merchants */
router.get(
  "/",
  validate.listMerchantsValidation,
  controller.listMerchants
);

/* approved merchant */
router.patch(
  "/:id/approve",
  validate.approveMerchantValidation,
  controller.approveMerchant
);

/* rejected merchant */
router.patch(
  "/:id/reject",
  validate.rejectMerchantValidation,
  controller.rejectMerchant
);

/* update status */
router.patch(
  "/:id/status",
  validate.updateMerchantStatusValidation,
  controller.updateMerchantStatus
);

/* update admin and update profile */
router.put(
  "/:id",
  validate.updateMerchantValidation,
  controller.updateMerchant
);

/* delete */
router.delete(
  "/:id",
  validate.deleteMerchantValidation,
  controller.deleteMerchant
);

/* restore */
router.patch(
  "/:id/restore",
  validate.restoreMerchantValidation,
  controller.restoreMerchant
);

module.exports = router;
