const { body, param, query } = require("express-validator");
const TransportType = require("../../models/transportType.model");
const { Op } = require("sequelize");

const transportTypeValidationRules = {
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
      .withMessage("Transport type name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await TransportType.findOne({
          where: {
            name: value,
            language_code: req.body.language_code,
          },
        });
        if (exists)
          throw new Error(
            "Transport type name already exists for this language"
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
          const exists = await TransportType.findOne({
            where: { slug: value },
          });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid transport type ID")
      .custom(async (value) => {
        const transportType = await TransportType.findByPk(value);
        if (!transportType) throw new Error("Transport type not found");
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const transportType = await TransportType.findOne({
          where: {
            name: value,
            language_code: req.body.language_code,
            id: { [Op.ne]: req.params.id },
          },
        });
        if (transportType)
          throw new Error(
            "Transport type name already exists for this language"
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
          const exists = await TransportType.findOne({
            where: {
              slug: value,
              id: { [Op.ne]: req.params.id },
            },
          });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),
  ],

  getById: [param("id").isInt().withMessage("Invalid transport type ID")],

  delete: [param("id").isInt().withMessage("Invalid transport type ID")],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid transport type ID")
      .custom(async (value, { req }) => {
        const transportType = await TransportType.findOne({
          where: { id: value },
          paranoid: false,
        });
        if (!transportType)
          throw new Error("Transport type not found (including soft-deleted)");
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
  ],

  toggleVisibility: [
    param("id").isInt().withMessage("Invalid transport type ID"),
  ],
};

module.exports = transportTypeValidationRules;
