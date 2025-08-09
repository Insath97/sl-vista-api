const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/foodAndBeverage.controller");
const validate = require("../../utils/validations/foodAndBeverage.validation");
const middleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

// Get all food and beverages
router.get("/", validate.list, controller.getAllFoodAndBeverages);

// Get food and beverage by ID
router.get("/:id", validate.getById, controller.getFoodAndBeverageById);

router.use(middleware.authenticate);

// Create food and beverage
router.post(
  "/",
  uploadMiddleware,
  validate.create,
  controller.createFoodAndBeverage
);

// Get all food and beverages
router.get("/", validate.list, controller.getAllFoodAndBeverages);

// Get food and beverage by ID
router.get("/:id", validate.getById, controller.getFoodAndBeverageById);

// Update food and beverage
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateFoodAndBeverage
);

// Delete food and beverage
router.delete("/:id", validate.delete, controller.deleteFoodAndBeverage);

// Restore food and beverage
router.patch("/restore/:id", controller.restoreFoodAndBeverage);

// Toggle active status
router.patch(
  "/status/:id",
  // validate.toggleStatus,
  controller.toggleActiveStatus
);

// Verify food and beverage
router.patch(
  "/:id/verify",
  // validate.verify,
  controller.verifyFoodAndBeverage
);

// Update images
router.patch(
  "/:id/images",
  uploadMiddleware,
  // validate.updateImages,
  controller.updateImages
);

// Delete image
router.delete(
  "/:id/images/:imageId",
  // validate.deleteImage,
  controller.deleteImage
);

// Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  // validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
