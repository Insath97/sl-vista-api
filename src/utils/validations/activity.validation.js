const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Activity = require("../../models/activity.model");
const ActivityType = require("../../models/activityType.model");

// Reusable validators
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const activity = await Activity.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!activity) throw new Error("Activity not found");
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
    const exists = await Activity.findOne({ where });
    if (exists) throw new Error("Title already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers, and hyphens");

const validateVehicles = body("availableVehicles")
  .optional()
  .custom((value) => {
    try {
      const vehicles = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(vehicles);
    } catch {
      throw new Error("Invalid vehicles format");
    }
  });

const baseValidations = [
  body("activityTypeId")
    .isInt()
    .withMessage("Invalid activity type ID")
    .custom(async (value) => {
      const exists = await ActivityType.findByPk(value);
      if (!exists) throw new Error("Activity type not found");
    }),
  body("language_code")
    .isIn(["en", "ar", "fr"])
    .withMessage("Invalid language code"),
  body("difficulty").isIn(["Easy", "Moderate", "Hard", "Extreme"]),
  body("durationHours").isFloat({ min: 0.5, max: 24 }),
  body("price").isDecimal({ min: 0 }),
  // ... (Add other field validations like province, district, etc.)
];

module.exports = {
  create: [validateTitle, validateSlug, validateVehicles, ...baseValidations],
  update: [
    idParam,
    validateTitle.optional(),
    validateSlug.optional(),
    validateVehicles.optional(),
    ...baseValidations.map((v) => v.optional()),
  ],
  getById: [idParam],
  delete: [idParam],
  list: [
    query("activityTypeId").optional().isInt(),
    query("difficulty")
      .optional()
      .isIn(["Easy", "Moderate", "Hard", "Extreme"]),
    // ... (Add other query filters)
  ],
};
