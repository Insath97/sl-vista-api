const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const categoryController = require("../controllers/categoryController");
const categoryValidation = require("../utils/categoryValidation");

/* router.use(authMiddleware); */

// create category
router.post(
  "/",
  authMiddleware,
  categoryValidation.create,
  categoryController.CreateCategory
);

// get all categories
router.get("/", authMiddleware, categoryController.getAllCategories);

// get category by id
router.get("/:id", authMiddleware, categoryController.getCategoryById);

// update category by id
router.put(
  "/:id",
  authMiddleware,
  categoryValidation.update,
  categoryController.updateCategoryById
);

// delete category by id
router.delete(
  "/:id",
  authMiddleware,
  categoryValidation.delete,
  categoryController.deleteCategory
);

// get category by language code
router.get(
  "/language/:language_code",
  authMiddleware,
  categoryController.getCategoriesByLanguage
);

// toggle category visibility
router.patch(
  "/toggle/:id",
  authMiddleware,
  categoryController.toggleCategoryVisibility
);

// get categories for navbar
router.get("/navbar", authMiddleware, categoryController.getNavbarCategories);

module.exports = router;
