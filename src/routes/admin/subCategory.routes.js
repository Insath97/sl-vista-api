const express = require("express");
const router = express.Router();
const SubCategoryController = require("../../controllers/admin/subCategory.controller");
const SubCategoryValidation = require("../../utils/validations/subCategory.validation");
const middleware = require("../../middlewares/authMiddleware");
const subCategoryValidationRules = require("../../utils/validations/subCategory.validation");

router.use(middleware.authMiddlewareWithProfile("admin"));

router.post(
  "/",
  SubCategoryValidation.create,
  SubCategoryController.createSubCategory
);

router.get(
  "/",
  SubCategoryValidation.list,
  SubCategoryController.getAllSubCategories
);

router.get(
  "/:id",
  SubCategoryValidation.getById,
  SubCategoryController.getSubCategoryById
);

router.put(
  "/:id",
  SubCategoryValidation.update,
  SubCategoryController.updateSubCategory
);

router.delete(
  "/:id",
  SubCategoryValidation.delete,
  SubCategoryController.deleteSubCategory
);

router.get(
  "/category/:categoryId",
  SubCategoryValidation.getByCategory,
  SubCategoryController.getByCategory
);

module.exports = router;
