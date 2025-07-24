const express = require("express");
const router = express.Router();
const middleware = require("../../middlewares/auth.middleware");
const validate = require("../../utils/validations/amenity.validation");
const amenityController = require("../../controllers/admin/amenity.controller");


// CRUD Routes
router.post(
  "/",
  middleware.authMiddlewareWithProfile("admin"),
  validate.create,
  amenityController.createAmenity
);

router.get(
  "/",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  amenityController.getAllAmenities
);

router.get(
  "/:id",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  validate.getById,
  amenityController.getAmenityById
);

router.get(
  "/slug/:slug",
  middleware.authMiddlewareWithProfile("admin"),
  validate.getBySlug,
  amenityController.getAmenityBySlug
);

router.put(
  "/:id",
  middleware.authMiddlewareWithProfile("admin"),
  validate.update,
  amenityController.updateAmenity
);

router.delete(
  "/:id",
  middleware.authMiddlewareWithProfile("admin"),
  validate.delete,
  amenityController.deleteAmenity
);

router.patch(
  "/:id/restore",
  middleware.authMiddlewareWithProfile("admin"),
  validate.restore,
  amenityController.restoreAmenity
);

router.patch(
  "/:id/toggle-visibility",
  middleware.authMiddlewareWithProfile("admin"),
  validate.toggleVisibility,
  amenityController.toggleVisibility
);

module.exports = router;
