const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/localArtists.controller");
const validate = require("../../utils/validations/localArtists.validation");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware.authMiddlewareWithProfile(['admin']));

// Create local artist
router.post(
  "/",
  uploadMiddleware,
  /*  validate.create, */
  controller.createLocalArtist
);

// Get all local artists
router.get("/", /* validate.list */ controller.getAllLocalArtists);

// Get local artist by ID
router.get("/:id", /* validate.getById */ controller.getLocalArtistById);

// Update local artist
router.put(
  "/:id",
  uploadMiddleware,
  /* validate.update */
  controller.updateLocalArtist
);

// Delete local artist
router.delete("/:id", /* validate.delete, */ controller.deleteLocalArtist);

// Restore local artist
router.patch(
  "/restore/:id",
  /*  validate.restore, */
  controller.restoreLocalArtist
);

// Toggle active status
router.patch(
  "/status/:id",
  /*   validate.toggleStatus, */
  controller.toggleActiveStatus
);

// Verify local artist
router.patch(
  "/verify/:id",
  /* validate.verify, */
  controller.verifyLocalArtist
);

// Update artist types
router.patch(
  "/:id/artist-types",
  /*  validate.updateArtistTypes, */
  controller.updateArtistTypes
);

// Update images
router.patch(
  "/:id/images",
  uploadMiddleware,
  /* validate.updateImages, */
  controller.updateImages
);

// Delete image
router.delete(
  "/:id/images/:imageId",
  /*  validate.deleteImage, */
  controller.deleteImage
);

// Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  /*   validate.setFeaturedImage, */
  controller.setFeaturedImage
);

module.exports = router;
