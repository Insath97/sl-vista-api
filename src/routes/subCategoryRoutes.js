const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const SubcategoryController = require("../controllers/subCategoryController");
const subcategoryValidation = require("../utils/subcategory.validation");

// Create
router.post(
    "/",
    authMiddleware,
    subcategoryValidation.create,
    SubcategoryController.CreateSubCategory
);

// Get all
router.get(
    "/",
    authMiddleware,
    SubcategoryController.getAllSubcategories
);

// Get by ID
router.get(
    "/:id",
    authMiddleware,
    subcategoryValidation.getById,
    SubcategoryController.getSubCategoryById
);

// Update
router.put(
    '/:id',
    authMiddleware,
    subcategoryValidation.update,
    SubcategoryController.updateSubCategoryById
);

// Soft Delete
router.delete(
    "/:id",
    authMiddleware,
    subcategoryValidation.delete,
    SubcategoryController.deleteSubCategory
);


module.exports = router;