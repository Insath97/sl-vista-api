const { body, param, query } = require("express-validator");
const ArtistType = require("../../models/artistsType.model");
const { Op } = require("sequelize");

const artistTypeValidationRules = {
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Artist type name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value) => {
        const exists = await ArtistType.findOne({
          where: { name: value }
        });
        if (exists) throw new Error("Artist type name already exists");
        return true;
      }),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description must be less than 2000 characters"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid artist type ID")
      .custom(async (value) => {
        const artistType = await ArtistType.findByPk(value);
        if (!artistType) throw new Error("Artist type not found");
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        if (value) {
          const exists = await ArtistType.findOne({
            where: {
              name: value,
              id: { [Op.ne]: req.params.id },
            },
          });
          if (exists) throw new Error("Artist type name already exists");
        }
        return true;
      }),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description must be less than 2000 characters"),
  ],

  getById: [
    param("id")
      .isInt()
      .withMessage("Invalid artist type ID")
      .custom(async (value) => {
        const artistType = await ArtistType.findByPk(value);
        if (!artistType) throw new Error("Artist type not found");
        return true;
      }),

    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be a boolean value"),
  ],

  delete: [
    param("id")
      .isInt()
      .withMessage("Invalid artist type ID")
      .custom(async (value) => {
        const artistType = await ArtistType.findByPk(value);
        if (!artistType) throw new Error("Artist type not found");
        return true;
      }),
  ],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid artist type ID")
      .custom(async (value) => {
        const artistType = await ArtistType.findOne({
          where: { id: value },
          paranoid: false,
        });
        if (!artistType) throw new Error("Artist type not found (including soft-deleted)");
        if (!artistType.deletedAt) throw new Error("Artist type is not deleted");
        return true;
      }),
  ],

  list: [
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be a boolean value"),
  ],

  toggleVisibility: [
    param("id")
      .isInt()
      .withMessage("Invalid artist type ID")
      .custom(async (value) => {
        const artistType = await ArtistType.findByPk(value);
        if (!artistType) throw new Error("Artist type not found");
        return true;
      }),
  ],
};

module.exports = artistTypeValidationRules;