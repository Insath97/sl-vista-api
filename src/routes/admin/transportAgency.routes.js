const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/transportAgency.controller");
const validate = require("../../utils/validations/transportAgency.validation");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware);

// Create transport agency
router.post(
  "/",
  uploadMiddleware,
  validate.create,
  controller.createTransportAgency
);

// Get all transport agencies
router.get("/", validate.list, controller.getAllTransportAgencies);

// Get transport agency by ID
router.get("/:id", validate.getById, controller.getTransportAgencyById);

// Update transport agency
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateTransportAgency
);

// Delete transport agency
router.delete("/:id", validate.delete, controller.deleteTransportAgency);

// Restore transport agency
router.patch(
  "/restore/:id",
  controller.restoreTransportAgency
);

// Toggle active status
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

// Verify transport agency
router.patch("/:id/verify", validate.verify, controller.verifyTransportAgency);

// Update transport types
router.patch(
  "/:id/transport-types",
  validate.updateTransportTypes,
  controller.updateTransportTypes
);

// Update images
router.patch(
  "/:id/images",
  uploadMiddleware,
  validate.updateImages,
  controller.updateImages
);

// Delete image
router.delete(
  "/:id/images/:imageId",
  validate.deleteImage,
  controller.deleteImage
);

// Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
