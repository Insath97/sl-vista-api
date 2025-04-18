const { body, param } = require("express-validator");

const subcategoryValidationRules = {
  create: [
    body("categoryId")
      .notEmpty()
      .withMessage("Category ID is required")
      .isInt({ min: 1 })
      .withMessage("Category ID must be a valid integer"),
    body("language_code").notEmpty().withMessage("Language code is required"),
    body("name")
      .notEmpty()
      .withMessage("SubCategory name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),
    body("icon").optional().isString().withMessage("Icon must be a string"),
    body("position")
      .optional()
      .isInt()
      .withMessage("Position must be an integer"),
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
      .isString()
      .withMessage("Description must be a string"),
  ],

  update: [
    param("id").isInt().withMessage("Invalid SubCategory ID"),
    body("categoryId")
      .optional()
      .isInt()
      .withMessage("Category ID must be a valid integer"),
    body("language_code")
      .optional()
      .notEmpty()
      .withMessage("Language code cannot be empty"),
    body("name")
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),
    body("icon").optional().isString().withMessage("Icon must be a string"),
    body("position")
      .optional()
      .isInt()
      .withMessage("Position must be an integer"),
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
      .isString()
      .withMessage("Description must be a string"),
  ],

  delete: [param("id").isInt().withMessage("Invalid SubCategory ID")],

  toggleVisibility: [param("id").isInt().withMessage("Invalid SubCategory ID")],

  getById: [param("id").isInt().withMessage("Invalid SubCategory ID")],
};

module.exports = subcategoryValidationRules;
