const express = require("express");
const router = express.Router();
const middleware = require("../../middlewares/auth.middleware");
const validate = require("../../utils/validations/amenity.validation");
const amenityController = require("../../controllers/admin/amenity.controller");

router.use(middleware.authenticate);

router.post("/", validate.create, amenityController.createAmenity);

router.get("/", amenityController.getAllAmenities);

router.get("/:id", validate.getById, amenityController.getAmenityById);

router.get(
  "/slug/:slug",
  validate.getBySlug,
  amenityController.getAmenityBySlug
);

router.put("/:id", validate.update, amenityController.updateAmenity);

router.delete("/:id", validate.delete, amenityController.deleteAmenity);

router.patch(
  "/:id/restore",
  validate.restore,
  amenityController.restoreAmenity
);

router.patch(
  "/:id/toggle-visibility",
  validate.toggleVisibility,
  amenityController.toggleVisibility
);

module.exports = router;
