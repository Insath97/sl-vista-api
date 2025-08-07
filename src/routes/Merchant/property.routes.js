const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/property.controller");
const validate = require("../../utils/validations/property.validation");
const middleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

// Apply authentication middleware to all routes
router.use(middleware.authenticate);

// Create property
router.post("/", uploadMiddleware, validate.create, controller.createProperty);

// Get all properties
router.get("/", validate.list, controller.getAllProperties);

// Get property by ID
router.get("/:id", validate.getById, controller.getPropertyById);

// Update property
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateProperty
);

// Delete property
router.delete("/:id", validate.delete, controller.deleteProperty);

// Restore property
router.patch("/:id/restore", validate.restore, controller.restoreProperty);

// Toggle active status
router.patch(
  "/:id/status",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

// Verify property (admin only)
router.patch("/:id/verify", validate.verify, controller.verifyProperty);

// Update amenities
router.patch(
  "/:id/amenities",
  validate.updateAmenities,
  controller.updateAmenities
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

router.get("/list/dropdown", controller.getMerchantPropertiesForDropdown);

module.exports = router;
