const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const LocalArtistType = require("../../models/localArtistType.model");

const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const exists = await LocalArtistType.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true
    });
    if (!exists) throw new Error("Local artist type not found");
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
    const exists = await LocalArtistType.findOne({ where });
    if (exists) throw new Error("Name already exists");
  });

const validateSlug = body("slug")
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters")
  .custom(async (value, { req }) => {
    const where = {
      slug: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await LocalArtistType.findOne({ where });
    if (exists) throw new Error("Slug already exists");
  });

const validateLanguageCode = body("language_code")
  .isIn(["en", "ar", "fr"])
  .withMessage("Invalid language code");

const validateIcon = body("icon")
  .optional()
  .isURL()
  .withMessage("Icon must be a valid URL")
  .isLength({ max: 255 })
  .withMessage("Icon path must be less than 255 characters");

module.exports = {
  create: [
    validateName,
    validateSlug,
    validateLanguageCode,
    validateIcon,
    body("isActive").optional().isBoolean(),
  ],
  
  update: [
    idParam,
    validateName.optional(),
    validateSlug.optional(),
    validateLanguageCode.optional(),
    validateIcon,
    body("isActive").optional().isBoolean(),
  ],
  
  getById: [
    idParam,
    query("includeDeleted").optional().isBoolean()
  ],
  
  delete: [idParam],
  
  restore: [idParam],
  
  list: [
    query("language_code").optional().isIn(["en", "ar", "fr"]),
    query("includeInactive").optional().isBoolean(),
    query("search").optional().isLength({ max: 100 }),
    query("includeDeleted").optional().isBoolean(),
  ],
  
  toggleStatus: [idParam],
};