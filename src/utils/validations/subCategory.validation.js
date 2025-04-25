const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const SubCategory = require("../../models/subCategory.model");
const Category = require("../../models/category.model");

const subCategoryValidationRules = {
  create: [
    body("categoryId")
      .isInt()
      .withMessage("Valid category ID is required")
      .custom(async (value) => {
        const category = await Category.findByPk(value);
        if (!category) {
          throw new Error("Category not found");
        }
        return true;
      }),

    body("name")
      .trim()
      .notEmpty()
      .withMessage("SubCategory name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await SubCategory.findOne({
          where: {
            name: value,
            categoryId: req.body.categoryId,
          },
        });
        if (exists) {
          throw new Error("SubCategory name already exists in this category");
        }
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage(
        "Slug can only contain lowercase letters, numbers and hyphens"
      )
      .custom(async (value) => {
        if (value) {
          const exists = await SubCategory.findOne({ where: { slug: value } });
          if (exists) {
            throw new Error("Slug is already in use");
          }
        }
        return true;
      }),

    body("icon").optional().isURL().withMessage("Icon must be a valid URL"),

    body("position")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Position must be a positive integer"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Description cannot exceed 1000 characters"),

    body("metaTitle")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Meta title cannot exceed 100 characters"),

    body("metaDescription")
      .optional()
      .trim()
      .isLength({ max: 160 })
      .withMessage("Meta description cannot exceed 160 characters"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid subcategory ID")
      .custom(async (value) => {
        const subCategory = await SubCategory.findByPk(value);
        if (!subCategory) {
          throw new Error("SubCategory not found");
        }
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const subCategory = await SubCategory.findOne({
          where: {
            name: value,
            categoryId:
              req.body.categoryId ||
              (
                await SubCategory.findByPk(req.params.id)
              ).categoryId,
            id: { [Op.ne]: req.params.id },
          },
        });
        if (subCategory) {
          throw new Error("SubCategory name already exists in this category");
        }
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage(
        "Slug can only contain lowercase letters, numbers and hyphens"
      )
      .custom(async (value, { req }) => {
        if (value) {
          const exists = await SubCategory.findOne({
            where: {
              slug: value,
              id: { [Op.ne]: req.params.id },
            },
          });
          if (exists) {
            throw new Error("Slug is already in use");
          }
        }
        return true;
      }),

    // Other fields same as create...
  ],

  getById: [param("id").isInt().withMessage("Invalid subcategory ID")],

  delete: [param("id").isInt().withMessage("Invalid subcategory ID")],

  list: [
    query("categoryId").optional().isInt().withMessage("Invalid category ID"),

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1-100"),

    query("includeCategory")
      .optional()
      .isBoolean()
      .withMessage("includeCategory must be a boolean value"),
  ],

  toggleVisibility: [param("id").isInt().withMessage("Invalid subcategory ID")],

  getByCategory: [
    param("categoryId").isInt().withMessage("Invalid category ID"),

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    query("includeCategory")
      .optional()
      .isBoolean()
      .withMessage("includeCategory must be a boolean value"),
  ],
};

module.exports = subCategoryValidationRules;
