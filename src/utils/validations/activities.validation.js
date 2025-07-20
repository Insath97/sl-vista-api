const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Activities = require("../../models/activities.model");
const ActivitiesImages = require("../../models/activitesimages.model");

// Common ID param validation
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const item = await Activities.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!item) throw new Error("Activity not found");
  });

const validateTitle = body("title")
  .trim()
  .notEmpty()
  .withMessage("Title is required")
  .isLength({ min: 2, max: 100 })
  .withMessage("Title must be 2–100 characters")
  .custom(async (value, { req }) => {
    const where = {
      title: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await Activities.findOne({ where });
    if (exists) throw new Error("Title already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

const baseValidations = [
  body("pricerange")
    .notEmpty()
    .withMessage("Price range is required")
    .isLength({ max: 20 })
    .withMessage("Price range must be less than 20 characters"),

  body("type")
    .notEmpty()
    .withMessage("Type is required")
    .isIn([
      "Adventure",
      "Cultural",
      "Historical",
      "Nature & Wildlife",
      "Wellness & Spa",
      "Culinary / Food Tour",
      "Arts & Crafts",
      "Water Activities",
      "Sports & Games",
      "Religious / Spiritual",
    ])
    .withMessage("Invalid activity type"),

  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("email").optional().isEmail().withMessage("Invalid email format"),

  body("district")
    .optional()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  body("city")
    .optional()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("vista")
    .optional()
    .isIn(["Verified", "Not Verified"])
    .withMessage("Invalid vista status"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

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

const queryValidations = [
  query("includeInactive").optional().isBoolean(),
  query("includeImages").optional().isBoolean(),
  query("includeDeleted").optional().isBoolean(),
  query("search").optional().isLength({ max: 100 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("city").optional().isLength({ max: 50 }),
  query("district").optional().isLength({ max: 50 }),
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid activity ID"),
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
  param("id").isInt().withMessage("Invalid activity ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = deleteImageValidation;

module.exports = {
  create: [
    validateTitle,
    validateSlug,
    ...baseValidations,
    ...imageValidations,
  ],
  update: [
    idParam,
    validateTitle.optional(),
    validateSlug,
    ...baseValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],
  getById: [idParam, query("includeDeleted").optional().isBoolean()],
  delete: [idParam],
  list: queryValidations,
  toggleStatus: [idParam],
  restore: [idParam],
  updateImages: updateImagesValidation,
  deleteImage: deleteImageValidation,
  setFeaturedImage: setFeaturedImageValidation,
};
