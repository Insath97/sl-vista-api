const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const FoodAndBeverage = require("../../models/foodAndBeverages.model");
const FoodAndBeverageImage = require("../../models/FoodAndBeverageImages.model");

// Common ID param validation
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const item = await FoodAndBeverage.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!item) throw new Error("Food and Beverage item not found");
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

const baseValidations = [
  body("cuisineType").notEmpty().withMessage("Cuisine type is required"),

  body("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  body("phone")
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("email").optional().isEmail().withMessage("Invalid email format"),

  body("website").optional().isURL().withMessage("Invalid website URL"),

  body("city")
    .optional()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("status")
    .optional()
    .isIn(["Active", "Pending", "inactive"])
    .withMessage("Invalid status"),
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
  query("province").optional().isLength({ max: 50 }),
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
