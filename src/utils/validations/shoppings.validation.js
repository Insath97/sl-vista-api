const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Shopping = require("../../models/shoppings.model");
const ShoppingImages = require("../../models/shoppingimages.model");

// Common ID param validation
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const item = await Shopping.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!item) throw new Error("Shopping item not found");
  });

// Unique and validated name
const validateName = body("name")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Name must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = {
      name: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await Shopping.findOne({ where });
    if (exists) throw new Error("Name already exists");
  });

// Slug validation
const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// Core fields validation
const baseValidations = [
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["Handicrafts", "Textiles", "Jewelry", "Art", "Pottery"])
    .withMessage("Invalid category"),

  body("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("phone")
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("email").optional().isEmail().withMessage("Invalid email format"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

// Images array validation
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

// Query param validation for GET /list or filters
const queryValidations = [
  query("includeInactive").optional().isBoolean(),
  query("includeImages").optional().isBoolean(),
  query("includeDeleted").optional().isBoolean(),
  query("search").optional().isLength({ max: 100 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("city").optional().isLength({ max: 50 }),
  query("province").optional().isLength({ max: 50 }),
];

// Images update payload
const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid shopping ID"),
  body("images")
    .isArray({ min: 1 })
    .withMessage("Images array cannot be empty"),
  ...imageValidations,
  body("images.*.id")
    .optional()
    .isInt()
    .withMessage("Image ID must be an integer"),
];

// For deleting or setting featured image
const deleteImageValidation = [
  param("id").isInt().withMessage("Invalid shopping ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = deleteImageValidation;

module.exports = {
  create: [validateName, validateSlug, ...baseValidations, ...imageValidations],
  update: [
    idParam,
    validateName.optional(),
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
