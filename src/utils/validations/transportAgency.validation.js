const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const TransportAgency = require("../../models/transportAgency.model");
const TransportType = require("../../models/transportType.model");
const TransportAgencyImage = require("../../models/transportAgencyImages.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const agency = await TransportAgency.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!agency) throw new Error("Transport agency not found");
  });

const validateTitle = body("title")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Title must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = {
      title: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await TransportAgency.findOne({ where });
    if (exists) throw new Error("Title already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// Transport agency basic validations
const agencyValidations = [
  body("serviceArea")
    .trim()
    .notEmpty()
    .withMessage("Service area is required")
    .isLength({ max: 100 })
    .withMessage("Service area must be less than 100 characters"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 10, max: 255 })
    .withMessage("Address must be between 10-255 characters"),

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

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid website URL")
    .isLength({ max: 255 })
    .withMessage("Website URL must be less than 255 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("district")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  body("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value"),
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

  query("includeTypes")
    .optional()
    .isBoolean()
    .withMessage("includeTypes must be a boolean"),

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

  query("district")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  query("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),
];

// Transport type validations
const transportTypeValidations = [
  body("transportTypes")
    .optional()
    .customSanitizer((value) => {
      if (typeof value === "string") {
        return value.split(",").map((id) => parseInt(id.trim()));
      }
      return value;
    })
    .custom((value) => {
      if (value && !Array.isArray(value)) {
        throw new Error("Transport types must be an array or comma-separated string");
      }
      return true;
    }),

  body("transportTypes.*")
    .optional()
    .isInt()
    .withMessage("Transport type ID must be an integer")
    .custom(async (value) => {
      const type = await TransportType.findByPk(value);
      if (!type) throw new Error(`Transport type with ID ${value} not found`);
      return true;
    }),
];

// Image validations
const imageValidations = [
  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*.imageUrl")
    .isURL()
    .withMessage("Image URL must be a valid URL")
    .isLength({ max: 512 })
    .withMessage("Image URL must be less than 512 characters"),

  body("images.*.caption")
    .optional()
    .isString()
    .withMessage("Caption must be a string")
    .isLength({ max: 255 })
    .withMessage("Caption must be less than 255 characters"),

  body("images.*.isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be a boolean"),

  body("images.*.sortOrder")
    .optional()
    .isInt()
    .withMessage("sortOrder must be an integer"),
];

const updateTransportTypesValidation = [
  param("id").isInt().withMessage("Invalid transport agency ID"),
  body("transportTypes")
    .isArray({ min: 1 })
    .withMessage("Transport types array cannot be empty"),
  ...transportTypeValidations,
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid transport agency ID"),
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
  param("id").isInt().withMessage("Invalid transport agency ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid transport agency ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

module.exports = {
  // Create Transport Agency
  create: [
    validateTitle,
    validateSlug,
    ...agencyValidations,
    ...transportTypeValidations,
    ...imageValidations,
  ],

  // Update Transport Agency
  update: [
    idParam,
    validateTitle.optional(),
    validateSlug,
    ...agencyValidations.map((v) => v.optional()),
    ...transportTypeValidations.map((v) => v.optional()),
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

  // Delete Transport Agency
  delete: [idParam],

  // List Transport Agencies
  list: queryValidations,

  // Toggle Active Status
  toggleStatus: [idParam],

  // Restore Soft-deleted Transport Agency
  restore: [idParam],

  // Update Transport Types
  updateTransportTypes: updateTransportTypesValidation,

  // Verify Transport Agency
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