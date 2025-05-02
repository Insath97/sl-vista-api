const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/transport.controller");
const validate = require("../../utils/validations/transport.validation");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware);

// Create transport
router.post(
  "/",
  uploadMiddleware,
  validate.create,
  controller.createTransport
);

// Get all transports
router.get("/", validate.list, controller.getAllTransports);

// Get transport by ID
router.get("/:id", validate.getById, controller.getTransportById);

// Update transport
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateTransport
);

// Delete transport
router.delete("/:id", validate.delete, controller.deleteTransport);

// Restore transport
router.patch("/restore/:id", validate.restore, controller.restoreTransport);

// Toggle active status
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

// Verify transport
router.patch("/:id/verify", validate.verify, controller.verifyTransport);

// Update amenities
router.patch(
  "/:id/amenities",
  validate.updateAmenities,
  controller.updateTransportAmenities
);

// Update images
router.patch(
  "/:id/images",
  uploadMiddleware,
  validate.updateImages,
  controller.updateTransportImages
);

// Delete image
router.delete(
  "/:id/images/:imageId",
  validate.deleteImage,
  controller.deleteTransportImage
);

// Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
