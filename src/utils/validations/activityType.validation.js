const { body, param, query } = require("express-validator");
const ActivityType = require("../../models/activityType.model");
const { Op } = require("sequelize");

const activityTypeValidationRules = {
  create: [
    body("language_code")
      .trim()
      .notEmpty()
      .withMessage("Language code is required")
      .isIn(["en", "ar", "fr"])
      .withMessage("Invalid language code. Only en, ar, fr are allowed"),

    body("name")
      .trim()
      .notEmpty()
      .withMessage("Activity type name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await ActivityType.findOne({
          where: {
            name: value,
            language_code: req.body.language_code,
          },
        });
        if (exists)
          throw new Error(
            "Activity type name already exists for this language"
          );
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage(
        "Slug can only contain lowercase letters, numbers and hyphens"
      )
      .custom(async (value) => {
        if (value) {
          const exists = await ActivityType.findOne({
            where: { slug: value },
          });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),

    body("icon")
      .optional()
      .isURL()
      .withMessage("Icon must be a valid URL")
      .isLength({ max: 255 })
      .withMessage("Icon URL must be less than 255 characters"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid activity type ID")
      .custom(async (value) => {
        const activityType = await ActivityType.findByPk(value);
        if (!activityType) throw new Error("Activity type not found");
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const activityType = await ActivityType.findOne({
          where: {
            name: value,
            language_code: req.body.language_code,
            id: { [Op.ne]: req.params.id },
          },
        });
        if (activityType)
          throw new Error(
            "Activity type name already exists for this language"
          );
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage(
        "Slug can only contain lowercase letters, numbers and hyphens"
      )
      .custom(async (value, { req }) => {
        if (value) {
          const exists = await ActivityType.findOne({
            where: {
              slug: value,
              id: { [Op.ne]: req.params.id },
            },
          });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),

    body("icon")
      .optional()
      .isURL()
      .withMessage("Icon must be a valid URL")
      .isLength({ max: 255 })
      .withMessage("Icon URL must be less than 255 characters"),
  ],

  getById: [param("id").isInt().withMessage("Invalid activity type ID")],

  delete: [param("id").isInt().withMessage("Invalid activity type ID")],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid activity type ID")
      .custom(async (value, { req }) => {
        const activityType = await ActivityType.findOne({
          where: { id: value },
          paranoid: false,
        });
        if (!activityType)
          throw new Error("Activity type not found (including soft-deleted)");
        return true;
      }),
  ],

  list: [
    query("language_code")
      .optional()
      .isIn(["en", "ar", "fr"])
      .withMessage("Invalid language code"),

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    query("search")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Search query must be less than 100 characters"),
  ],

  toggleStatus: [param("id").isInt().withMessage("Invalid activity type ID")],
};

module.exports = activityTypeValidationRules;
