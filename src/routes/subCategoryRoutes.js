const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const SubcategoryController = require("../controllers/subCategoryController");
const subcategoryValidation = require("../utils/subcategory.validation");

// Create
router.post(
    "/",
    authMiddleware.authMiddleware,
    subcategoryValidation.create,
    SubcategoryController.CreateSubCategory
);

// Get all
router.get(
    "/",
    authMiddleware.authMiddleware,
    SubcategoryController.getAllSubcategories
);

// Get by ID
router.get(
    "/:id",
    authMiddleware.authMiddleware,
    subcategoryValidation.getById,
    SubcategoryController.getSubCategoryById
);

// Update
router.put(
    '/:id',
    authMiddleware.authMiddleware,
    subcategoryValidation.update,
    SubcategoryController.updateSubCategoryById
);

// Soft Delete
router.delete(
    "/:id",
    authMiddleware.authMiddleware,
    subcategoryValidation.delete,
    SubcategoryController.deleteSubCategory
);


module.exports = router;