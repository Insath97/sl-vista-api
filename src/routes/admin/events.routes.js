const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/events.controller");
const validate = require("../../utils/validations/events.validation");
const authMiddleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware.authMiddlewareWithProfile(["admin"]));

// Create events
router.post(
  "/",
  uploadMiddleware,
  // validate.create,
  controller.createEvent
);

// Get all events
router.get("/", validate.list, controller.getAllEvents);

// Get single event by ID
router.get(
  "/:id",
  // validate.getById,
  controller.getEventById
);

// Update event by ID
router.put(
  "/:id",
  uploadMiddleware,
  // validate.update, // (optional validation)
  controller.updateEvent
);

// DELETE event by ID
router.delete("/:id", validate.delete, controller.deleteEvent);

// Restore
router.patch("/restore/:id", controller.restoreEvent);

// Toggle active status
router.patch(
  "/status/:id",
  // validate.toggleStatus,
  controller.toggleActiveStatus
);

//verify
router.patch(
  "/:id/verify",
  // validate.verify,
  controller.verifyEvent
);

// Update images
router.put(
  "/images/:id",
  uploadMiddleware,
  //validate.updateImages,
  controller.updateImages
);

// Delete event image
router.delete(
  "/:id/images/:imageId",
  // validate.deleteImage,
  controller.deleteImage
);

// Set Featured Image for Event
router.patch(
  "/:id/images/:imageId/featured",
  // validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
