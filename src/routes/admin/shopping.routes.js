const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/shopping.controller");
const validate = require("../../utils/validations/shoppings.validation");
const authMiddleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware.authMiddlewareWithProfile(['admin']));

// Create events
router.post(
  "/",
  uploadMiddleware,
  // validate.create,
  controller.createShopping
);

//Get all shopping items
router.get("/", validate.list, controller.getAllShoppings);

// Get single shopping item by ID
router.get(
  "/:id",
  // validate.getById,
  controller.getShoppingById
);

// Update shopping item by ID
router.put(
  "/:id",
  uploadMiddleware,
  // validate.update, // (optional validation)
  controller.updateShopping
);
// DELETE shopping item by ID
router.delete("/:id", validate.delete, controller.deleteShopping);

// PATCH /restore/:id
router.patch("/restore/:id", validate.restore, controller.restoreShopping);

// Toggle active status
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

// Verify shopping item
router.patch(
  "/:id/verify",
  // validate.verify,
  controller.verifyShopping
);

//Update images
router.put(
  "/:id/images",
  uploadMiddleware,
  // validate.updateImages,
  controller.updateShoppingImages
);

// Delete shopping image
router.delete(
  "/:id/images/:imageId",
  // validate.deleteImage,
  controller.deleteImage
);

// Set Featured Image for Shopping
router.patch(
  "/:id/images/:imageId/featured",
  // validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
