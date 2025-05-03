const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/localArtist.validation");
const controller = require("../../controllers/admin/localArtist.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware);

// Create local artist with images
router.post(
  "/",
  uploadMiddleware,
  validate.create,
  controller.createLocalArtist
);

// Get all local artists with optional filters
router.get("/", validate.list, controller.getAllLocalArtists);

// Get local artist by ID with optional images
router.get("/:id", validate.getById, controller.getLocalArtistById);

// Update local artist with optional images
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateLocalArtist
);

// Delete local artist (soft delete)
router.delete("/:id", validate.delete, controller.deleteLocalArtist);

// Restore soft-deleted local artist
router.patch("/:id/restore", validate.restore, controller.restoreLocalArtist);

// Toggle active status
router.patch(
  "/:id/status",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

// Update artist images (replace all)
router.patch(
  "/:id/images",
  uploadMiddleware,
  validate.updateImages,
  controller.updateLocalArtistImages
);

// Delete specific artist image
router.delete(
  "/:id/images/:imageId",
  validate.deleteImage,
  controller.deleteLocalArtistImage
);

// Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
