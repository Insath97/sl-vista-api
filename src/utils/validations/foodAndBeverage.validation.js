const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const FoodAndBeverage = require("../../models/foodAndBeverages.model");
const FoodAndBeveragesImage = require("../../models/FoodAndBeverageImages.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const foodAndBeverage = await FoodAndBeverage.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!foodAndBeverage) throw new Error("Food and beverage not found");
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
    const exists = await FoodAndBeverage.findOne({ where });
    if (exists) throw new Error("Name already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// FoodAndBeverage basic validations
const foodAndBeverageValidations = [
  body("cuisineType")
    .isIn([
      "Chinese",
      "Japanese",
      "Thai",
      "Indian",
      "Korean",
      "Vietnamese",
      "Indonesian",
    ])
    .withMessage("Invalid cuisine type"),

  body("province")
    .optional()
    .isIn([
      "Western",
      "Central",
      "Southern",
      "Northern",
      "Eastern",
      "North Western",
      "North Central",
      "Uva",
      "Sabaragamuwa",
    ])
    .withMessage("Invalid province"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("website").optional().trim().isURL().withMessage("Invalid website URL"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

// Query validations
const queryValidations = [
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),

  query("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  query("province")
    .optional()
    .isIn([
      "Western",
      "Central",
      "Southern",
      "Northern",
      "Eastern",
      "North Western",
      "North Central",
      "Uva",
      "Sabaragamuwa",
    ])
    .withMessage("Invalid province"),

  query("cuisineType")
    .optional()
    .isIn([
      "Chinese",
      "Japanese",
      "Thai",
      "Indian",
      "Korean",
      "Vietnamese",
      "Indonesian",
    ])
    .withMessage("Invalid cuisine type"),
];

// Image validations
const imageValidations = [
  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*.imageUrl")
    .isURL()
    .withMessage("Image URL must be a valid URL")
    .isLength({ max: 512 })
    .withMessage("Image URL must be less than 512 characters"),

  body("images.*.s3Key")
    .optional()
    .isString()
    .withMessage("S3 key must be a string")
    .isLength({ max: 512 })
    .withMessage("S3 key must be less than 512 characters"),

  body("images.*.fileName")
    .optional()
    .isString()
    .withMessage("File name must be a string")
    .isLength({ max: 255 })
    .withMessage("File name must be less than 255 characters"),

  body("images.*.size")
    .optional()
    .isInt()
    .withMessage("Size must be an integer"),

  body("images.*.sortOrder")
    .optional()
    .isInt()
    .withMessage("sortOrder must be an integer"),
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid food and beverage ID"),
  body("images")
    .isArray({ min: 1 })
    .withMessage("Images array cannot be empty"),
  ...imageValidations,
  body("images.*.id")
    .optional()
    .isInt()
    .withMessage("Image ID must be an integer"),
];

const deleteImageValidation = [
  param("id").isInt().withMessage("Invalid food and beverage ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid food and beverage ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

module.exports = {
  // Create FoodAndBeverage
  create: [
    validateName,
    validateSlug,
    ...foodAndBeverageValidations,
    ...imageValidations.map((v) => v.optional()),
  ],

  // Update FoodAndBeverage
  update: [
    idParam,
    validateName.optional(),
    validateSlug,
    ...foodAndBeverageValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],

  // Get by ID
  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
  ],

  // Delete FoodAndBeverage
  delete: [idParam],

  // List FoodAndBeverages
  list: queryValidations,

  // Toggle Active Status
  toggleStatus: [idParam],

  // Restore Soft-deleted FoodAndBeverage
  restore: [idParam],

  // Verify FoodAndBeverage
  verify: [
    idParam,
    body("verified")
      .optional()
      .isBoolean()
      .withMessage("verified must be a boolean"),
  ],

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Set Featured Image
  setFeaturedImage: setFeaturedImageValidation,
};
