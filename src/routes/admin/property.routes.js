const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/property.controller");
const validate = require("../../utils/validations/property.validation");
const middleware = require("../../middlewares/auth.middleware");

router.use(middleware.authMiddlewareWithProfile("admin"));

/* Get all merchant properties */
router.get("/", validate.list, controller.getAllMerchantProperties);

/* Update property approval status */
router.patch(
  "/:id/approval-status",
  validate.updateApprovalStatus,
  controller.updatePropertyApprovalStatus
);

/* Get property by ID */
router.get(
  "/:id",
  validate.getApprovedPropertyById,
  controller.getApprovedPropertyById
);

module.exports = router;
