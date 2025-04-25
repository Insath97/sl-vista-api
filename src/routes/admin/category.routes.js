const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/admin/categoryController");
const validation = require("../../utils/validations/category.validation");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

/* CREATE NEW CATEGORY */
router.post("/", validation.create, categoryController.createCategory);

// Get all categories
router.get("/", validation.list, categoryController.getAllCategories);

// Get a single category by ID
router.get(
  "/:id",
  categoryController.getCategoryById
);

// Update a category
router.put("/:id", validation.update, categoryController.updateCategory);

// Delete a category
router.delete(
  "/:id",
  categoryController.deleteCategory
);

// Toggle category visibility
router.patch(
  "/:id/toggle-visibility",
  validation.toggleVisibility,
  categoryController.toggleVisibility
);

// Toggle category nav visibility
router.patch(
  "/:id/toggle-nav",
  validation.toggleNavVisibility,
  categoryController.toggleNavVisibility
);

// Get navbar categories
router.get("/navbar/list", categoryController.getNavbarCategories);

// Get categories by language code
router.get(
  "/language/:language_code",
  categoryController.getCategoriesByLanguage
);

router.get(
  "/:id/subcategories",
  validation.getWithSubcategories,
  categoryController.getCategoryWithSubcategories
);

module.exports = router;
