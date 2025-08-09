const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Guides = require("../../models/guides.model");
const GuidesImages = require("../../models/guideImages.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const guide = await Guides.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!guide) throw new Error("Guide not found");
  });

const validateName = body("guide_name")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Name must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = {
      guide_name: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await Guides.findOne({ where });
    if (exists) throw new Error("Guide name already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// Guide basic validations
const guideValidations = [
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio must be less than 1000 characters"),

  body("languages")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(
          (lang) => typeof lang === "string" && lang.length <= 50
        );
      }
      return true;
    })
    .withMessage("Languages must be an array of strings (max 50 chars each)"),

  body("licenceId")
    .trim()
    .notEmpty()
    .withMessage("Licence ID is required")
    .isLength({ max: 100 })
    .withMessage("Licence ID must be less than 100 characters")
    .custom(async (value, { req }) => {
      const where = {
        licenceId: value,
        [Op.not]: { id: req.params?.id || 0 },
      };
      const existingGuide = await Guides.findOne({ where });
      if (existingGuide) throw new Error("Licence ID already in use");
      return true;
    }),

  body("expiryDate")
    .isDate()
    .withMessage("Invalid date format")
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error("Expiry date must be in the future");
      }
      return true;
    }),

  body("experience")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Experience must be a positive integer"),

  body("region")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must be less than 100 characters"),

  body("specialties")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(
          (spec) => typeof spec === "string" && spec.length <= 100
        );
      }
      return true;
    })
    .withMessage(
      "Specialties must be an array of strings (max 100 chars each)"
    ),

  body("ratePerDayAmount")
    .isFloat({ min: 0 })
    .withMessage("Rate must be a positive number"),

  body("ratePerDayCurrency")
    .isIn(["USD", "LKR", "EUR", "GBP"])
    .withMessage("Invalid currency"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("whatsapp")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("WhatsApp must be less than 20 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("instagram")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid Instagram URL")
    .isLength({ max: 100 })
    .withMessage("Instagram URL must be less than 100 characters"),

  body("facebook")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid Facebook URL")
    .isLength({ max: 100 })
    .withMessage("Facebook URL must be less than 100 characters"),
];

// Query validations
const queryValidations = [
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  query("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean"),

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("region")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must be less than 100 characters"),

  query("language")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Language must be less than 50 characters"),

  query("minExperience")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum experience must be a positive integer"),

  query("maxExperience")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum experience must be a positive integer"),

  query("minRate")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum rate must be a positive number"),

  query("maxRate")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum rate must be a positive number"),

  query("currency")
    .optional()
    .isIn(["USD", "LKR", "EUR", "GBP"])
    .withMessage("Invalid currency"),
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

  body("images.*.mimetype")
    .optional()
    .isString()
    .withMessage("Mimetype must be a string")
    .isLength({ max: 100 })
    .withMessage("Mimetype must be less than 100 characters"),

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

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid guide ID"),
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
  param("id").isInt().withMessage("Invalid guide ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid guide ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

module.exports = {
  // Create Guide
  create: [
    validateName,
    validateSlug,
    ...guideValidations,
    ...imageValidations.map((v) => v.optional()),
  ],

  // Update Guide
  // Update Guide validation
  update: [
    idParam,
    validateName.optional(),
    validateSlug,
    ...guideValidations.map((v) => {
      // Make licenceId validation optional for update, but validate if provided
      if (v === guideValidations.find((v) => v.field === "licenceId")) {
        return body("licenceId")
          .optional()
          .trim()
          .notEmpty()
          .withMessage("Licence ID is required")
          .isLength({ max: 100 })
          .withMessage("Licence ID must be less than 100 characters")
          .custom(async (value, { req }) => {
            if (!value) return true; // Skip if not provided
            const where = {
              licenceId: value,
              [Op.not]: { id: req.params?.id || 0 },
            };
            const existingGuide = await Guides.findOne({ where });
            if (existingGuide) throw new Error("Licence ID already in use");
            return true;
          });
      }
      return v.optional();
    }),
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

  // Delete Guide
  delete: [idParam],

  // List Guides
  list: queryValidations,

  // Toggle Active Status
  toggleStatus: [idParam],

  // Restore Soft-deleted Guide
  restore: [idParam],

  // Verify Guide
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
