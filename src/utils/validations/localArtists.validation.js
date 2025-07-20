const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const LocalArtists = require("../../models/localArtists.model");
const ArtistType = require("../../models/artistsType.model");
const LocalArtistImage = require("../../models/localArtistsImages.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const artist = await LocalArtists.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!artist) throw new Error("Local artist not found");
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
    const exists = await LocalArtists.findOne({ where });
    if (exists) throw new Error("Artist name already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// Local artist basic validations
const artistValidations = [
  body("specialization")
    .trim()
    .notEmpty()
    .withMessage("Specialization is required")
    .isLength({ max: 200 })
    .withMessage("Specialization must be less than 200 characters"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .matches(/^[+\d][\d\s-]+$/)
    .withMessage("Invalid phone number format")
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
    .isURL({
      protocols: ['http', 'https'],
      require_protocol: true
    })
    .withMessage("Invalid website URL (must include http:// or https://)"),

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

  query("artistTypeId")
    .optional()
    .isInt()
    .withMessage("Artist type ID must be an integer")
    .custom(async (value) => {
      if (value) {
        const type = await ArtistType.findByPk(value);
        if (!type) throw new Error(`Artist type with ID ${value} not found`);
      }
      return true;
    }),
];

// Artist type validations
const artistTypeValidations = [
  body("artistTypes")
    .optional()
    .customSanitizer((value) => {
      if (typeof value === "string") {
        return value.split(",").map((id) => parseInt(id.trim()));
      }
      return value;
    })
    .custom((value) => {
      if (value && !Array.isArray(value)) {
        throw new Error("Artist types must be an array or comma-separated string");
      }
      return true;
    }),

  body("artistTypes.*")
    .optional()
    .isInt()
    .withMessage("Artist type ID must be an integer")
    .custom(async (value) => {
      const type = await ArtistType.findByPk(value);
      if (!type) throw new Error(`Artist type with ID ${value} not found`);
      return true;
    }),
];

// Image validations
const imageValidations = [
  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*.imageUrl")
    .optional()
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
    .isInt({ min: 0 })
    .withMessage("Size must be a positive integer"),

  body("images.*.mimetype")
    .optional()
    .isString()
    .withMessage("MIME type must be a string")
    .isIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    .withMessage("Invalid image type"),

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

const updateArtistTypesValidation = [
  param("id").isInt().withMessage("Invalid local artist ID"),
  body("artistTypes")
    .isArray({ min: 1 })
    .withMessage("Artist types array cannot be empty"),
  ...artistTypeValidations,
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid local artist ID"),
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
  param("id").isInt().withMessage("Invalid local artist ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid local artist ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

module.exports = {
  // Create Local Artist
  create: [
    validateName,
    validateSlug,
    ...artistValidations,
    ...artistTypeValidations,
    ...imageValidations,
  ],

  // Update Local Artist
  update: [
    idParam,
    validateName.optional(),
    validateSlug,
    ...artistValidations.map((v) => v.optional()),
    ...artistTypeValidations.map((v) => v.optional()),
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

  // Delete Local Artist
  delete: [idParam],

  // List Local Artists
  list: queryValidations,

  // Toggle Active Status
  toggleStatus: [idParam],

  // Restore Soft-deleted Local Artist
  restore: [idParam],

  // Update Artist Types
  updateArtistTypes: updateArtistTypesValidation,

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Set Featured Image
  setFeaturedImage: setFeaturedImageValidation,
};