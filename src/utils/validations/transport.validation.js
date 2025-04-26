const { body, param, query } = require("express-validator");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const { Op } = require("sequelize");

const transportValidationRules = {
  create: [
    body("transportTypeId")
      .isInt()
      .withMessage("Invalid transport type ID")
      .custom(async (value) => {
        const transportType = await TransportType.findByPk(value);
        if (!transportType) throw new Error("Transport type not found");
        return true;
      }),

    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Title must be 2-100 characters")
      .custom(async (value, { req }) => {
        const exists = await Transport.findOne({
          where: {
            title: value,
            transportTypeId: req.body.transportTypeId,
          },
        });
        if (exists)
          throw new Error(
            "Transport with this title already exists for this type"
          );
        return true;
      }),

    body("operatorName")
      .trim()
      .notEmpty()
      .withMessage("Operator name is required")
      .isLength({ max: 100 })
      .withMessage("Operator name must be less than 100 characters"),

    body("pricePerKmUSD")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),

    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isLength({ max: 20 })
      .withMessage("Phone number too long"),

    body("email")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Invalid email format"),

    body("website")
      .optional()
      .trim()
      .isURL()
      .withMessage("Invalid website URL"),

    body("departureCity")
      .trim()
      .notEmpty()
      .withMessage("Departure city is required"),

    body("arrivalCity")
      .trim()
      .notEmpty()
      .withMessage("Arrival city is required"),

    body("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude value"),

    body("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude value"),
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid transport ID")
      .custom(async (value) => {
        const transport = await Transport.findByPk(value);
        if (!transport) throw new Error("Transport not found");
        return true;
      }),

    body("title")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Title must be 2-100 characters")
      .custom(async (value, { req }) => {
        const transport = await Transport.findOne({
          where: {
            title: value,
            transportTypeId:
              req.body.transportTypeId ||
              (
                await Transport.findByPk(req.params.id)
              ).transportTypeId,
            id: { [Op.ne]: req.params.id },
          },
        });
        if (transport)
          throw new Error(
            "Transport with this title already exists for this type"
          );
        return true;
      }),

    // Include other fields with same validation as create
    body("operatorName")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Operator name must be less than 100 characters"),

    body("pricePerKmUSD")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
  ],

  getById: [param("id").isInt().withMessage("Invalid transport ID")],

  delete: [param("id").isInt().withMessage("Invalid transport ID")],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid transport ID")
      .custom(async (value) => {
        const transport = await Transport.findOne({
          where: { id: value },
          paranoid: false,
        });
        if (!transport)
          throw new Error("Transport not found (including soft-deleted)");
        return true;
      }),
  ],

  toggleVerified: [param("id").isInt().withMessage("Invalid transport ID")],

  list: [
    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be a boolean"),
  ],
};

module.exports = transportValidationRules;
