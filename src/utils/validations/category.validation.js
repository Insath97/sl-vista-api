const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const db = require("../../models");

const categoryValidationRules = {
  create: [
    body("language_code")
      .trim()
      .notEmpty()
      .withMessage("Language code is required")
      .isIn(["en", "ar", "fr"])
      .withMessage("Invalid language code"),

    body("name")
      .trim()
      .notEmpty()
      .withMessage("Category name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await db.Category.findOne({
          where: {
            name: value,
            language_code: req.body.language_code,
          },
        });
        if (exists) {
          throw new Error("Category name already exists for this language");
        }
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug must be URL-friendly")
      .custom(async (value) => {
        if (value) {
          const exists = await db.Category.findOne({ where: { slug: value } });
          if (exists) {
            throw new Error("Slug already in use");
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
      .withMessage("isActive must be a boolean"),

    body("showInNav")
      .optional()
      .isBoolean()
      .withMessage("showInNav must be a boolean"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Description cannot exceed 1000 characters"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid category ID")
      .custom(async (value) => {
        const category = await db.Category.findByPk(value);
        if (!category) {
          throw new Error("Category not found");
        }
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be 2-100 characters"),

    // Include other fields as needed
  ],

  list: [
    query("language_code")
      .optional()
      .isIn(["en", "ar", "fr"])
      .withMessage("Invalid language code"),

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),

    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer")
      .toInt(),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1-100")
      .toInt(),
  ],
};

module.exports = categoryValidationRules;
