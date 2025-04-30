const { body, param } = require("express-validator");
const Amenity = require("../../models/amenity.model");
const { Op } = require("sequelize");

const amenityValidationRules = {
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await Amenity.findOne({ 
          where: { 
            name: value,
            language_code: req.body.language_code 
          } 
        });
        if (exists) throw new Error("Amenity name already exists for this language");
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
      .custom(async (value) => {
        if (value) {
          const exists = await Amenity.findOne({ where: { slug: value } });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),

    /* body("icon")
      .trim()
      .notEmpty()
      .withMessage("Icon path is required")
      .isURL()
      .withMessage("Icon must be a valid URL"), */

    body("language_code")
      .trim()
      .notEmpty()
      .withMessage("Language code is required")
      .isIn(["en", "ar", "fr"])
      .withMessage("Invalid language code"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid amenity ID")
      .custom(async (value) => {
        const amenity = await Amenity.findByPk(value);
        if (!amenity) throw new Error("Amenity not found");
        return true;
      }),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2-100 characters")
      .custom(async (value, { req }) => {
        const amenity = await Amenity.findOne({
          where: {
            name: value,
            language_code: req.body.language_code || (await Amenity.findByPk(req.params.id)).language_code,
            id: { [Op.ne]: req.params.id }
          }
        });
        if (amenity) throw new Error("Amenity name already exists for this language");
        return true;
      }),

    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
      .custom(async (value, { req }) => {
        if (value) {
          const exists = await Amenity.findOne({
            where: {
              slug: value,
              id: { [Op.ne]: req.params.id }
            }
          });
          if (exists) throw new Error("Slug is already in use");
        }
        return true;
      }),

    /* body("icon")
      .optional()
      .trim()
      .isURL()
      .withMessage("Icon must be a valid URL"), */
  ],

  getById: [param("id").isInt().withMessage("Invalid amenity ID")],

  delete: [param("id").isInt().withMessage("Invalid amenity ID")],

  getBySlug: [
    param("slug")
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Invalid slug format")
  ],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid amenity ID")
      .custom(async (value, { req }) => {
        const amenity = await Amenity.findOne({
          where: { id: value },
          paranoid: false
        });
        if (!amenity) throw new Error('Amenity not found (including soft-deleted)');
        return true;
      })
  ],

  toggleVisibility: [param("id").isInt().withMessage("Invalid amenity ID")]
};

module.exports = amenityValidationRules;