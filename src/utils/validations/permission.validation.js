const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Permission = require("../../models/permisson.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const permission = await Permission.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!permission) throw new Error("Permission not found");
  });

const validateName = body("name")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Name must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = {
      name: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await Permission.findOne({ where });
    if (exists) throw new Error("Permission name already exists");
  });

const validateCategory = body("category")
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage("Category must be 2-50 characters");

const validateUserType = body("userType")
  .isIn(["admin", "merchant"])
  .withMessage("User type must be either 'admin' or 'merchant'");

// Query validations
const queryValidations = [
  query("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must be less than 50 characters"),

  query("userType")
    .optional()
    .isIn(["admin", "merchant"])
    .withMessage("User type must be either 'admin' or 'merchant'"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean"),
];

module.exports = {
  // Create Permission
  create: [validateCategory, validateName, validateUserType],

  // Update Permission
  update: [
    idParam,
    validateCategory.optional(),
    validateName.optional(),
    validateUserType.optional(),
  ],

  // Get by ID
  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
  ],

  // List Permissions
  list: queryValidations,

  // Delete Permission
  delete: [idParam],

  // Restore Permission
  restore: [idParam],
};
