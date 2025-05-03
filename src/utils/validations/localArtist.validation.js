const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const LocalArtist = require("../../models/localArtist.model");
const LocalArtistType = require("../../models/localArtistType.model");
const LocalArtistImage = require("../../models/localArtistImage.model");

const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const artist = await LocalArtist.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!artist) throw new Error("Local artist not found");
  });

const imageIdParam = param("imageId")
  .isInt()
  .withMessage("Invalid image ID format")
  .custom(async (value, { req }) => {
    const image = await LocalArtistImage.findOne({
      where: { id: value, artistId: req.params.id },
    });
    if (!image) throw new Error("Image not found for this artist");
  });

const artistTypeExists = body("artistTypeId")
  .isInt()
  .withMessage("Invalid artist type ID")
  .custom(async (value) => {
    const exists = await LocalArtistType.findByPk(value);
    if (!exists) throw new Error("Artist type not found");
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
    const exists = await LocalArtist.findOne({ where });
    if (exists) throw new Error("Title already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

const validateLanguages = body("languages_spoken")
  .isArray({ min: 1 })
  .withMessage("At least one language must be specified")
  .custom((languages) => {
    const validCodes = ["en", "ar", "fr"];
    return languages.every((lang) => validCodes.includes(lang));
  })
  .withMessage("Invalid language code detected");

// Image validations
const validateImageUrl = body("images.*.imageUrl")
  .optional()
  .isURL()
  .withMessage("Image URL must be a valid URL")
  .isLength({ max: 512 })
  .withMessage("Image URL must be less than 512 characters");

const validateImageCaption = body("images.*.caption")
  .optional()
  .isString()
  .withMessage("Caption must be a string")
  .isLength({ max: 255 })
  .withMessage("Caption must be less than 255 characters");

const validateImageFeatured = body("images.*.isFeatured")
  .optional()
  .isBoolean()
  .withMessage("isFeatured must be a boolean");

const validateImageOrder = body("images.*.sortOrder")
  .optional()
  .isInt()
  .withMessage("sortOrder must be an integer");

const artistValidations = [
  body("specialization")
    .trim()
    .notEmpty()
    .withMessage("Specialization is required")
    .isLength({ max: 100 })
    .withMessage("Specialization must be less than 100 characters"),

  body("language_code")
    .isIn(["en", "ar", "fr"])
    .withMessage("Invalid language code"),

  body("province")
    .trim()
    .notEmpty()
    .withMessage("Province is required")
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required")
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),
    
  body("artistTypeId")
    .notEmpty()
    .withMessage("Artist type is required")
    .isInt()
    .withMessage("Artist type must be an integer"),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

const queryValidations = [
  query("artistTypeId")
    .optional()
    .isInt()
    .withMessage("artistTypeId must be an integer"),

  query("language_code")
    .optional()
    .isIn(["en", "ar", "fr"])
    .withMessage("Invalid language code"),

  query("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  query("district")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  query("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

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

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean"),
];

const imageValidations = [
  body("images").optional().isArray().withMessage("Images must be an array"),
  validateImageUrl,
  validateImageCaption,
  validateImageFeatured,
  validateImageOrder,
];

const updateImagesValidation = [
  idParam,
  body("images")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Images array cannot be empty"),
  ...imageValidations,
];

const deleteImageValidation = [idParam, imageIdParam];

const setFeaturedImageValidation = [idParam, imageIdParam];

module.exports = {
  create: [
    artistTypeExists,
    validateTitle,
    validateSlug,
    validateLanguages,
    ...artistValidations,
    ...imageValidations,
  ],

  update: [
    idParam,
    artistTypeExists.optional(),
    validateTitle.optional(),
    validateSlug,
    validateLanguages.optional(),
    ...artistValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],

  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
    query("includeImages")
      .optional()
      .isBoolean()
      .withMessage("includeImages must be a boolean"),
  ],

  delete: [idParam],

  list: queryValidations,

  restore: [idParam],

  toggleStatus: [idParam],

  updateImages: updateImagesValidation,

  deleteImage: deleteImageValidation,

  setFeaturedImage: setFeaturedImageValidation,
};
