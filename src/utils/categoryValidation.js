const { body, param } = require("express-validator");

// Validation rules
const categoryValidationRules = {
  create: [
    body("language_code").notEmpty().withMessage("Language code is required"),
    body("name")
      .notEmpty()
      .withMessage("Category name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Category name must be between 2 and 100 characters"),
    body("slug")
      .optional()
      .matches(/^[a-z0-9-]+$/i)
      .withMessage(
        "Slug must contain only lowercase letters, numbers, and hyphens"
      ),
    body("icon").optional().isString(),
    body("isActive").optional().isBoolean(),
    body("showInNav").optional().isBoolean(),
    body("description").optional().isString(),
  ],

  update: [
    param("id").isInt().withMessage("Invalid category ID"),
    body("language_code")
      .optional()
      .notEmpty()
      .withMessage("Language code cannot be empty"),
    body("name")
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage("Category name must be between 2 and 100 characters"),
    body("slug")
      .optional()
      .matches(/^[a-z0-9-]+$/i)
      .withMessage(
        "Slug must contain only lowercase letters, numbers, and hyphens"
      ),
    body("icon").optional().isString(),
    body("isActive").optional().isBoolean(),
    body("showInNav").optional().isBoolean(),
    body("description").optional().isString(),
  ],

  delete: [param("id").isInt().withMessage("Invalid category ID")],
};

module.exports = categoryValidationRules;
