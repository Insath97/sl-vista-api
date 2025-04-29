const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");

const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const transport = await Transport.findOne({
      where: { id: value },
      paranoid:
        req.method === "GET" && req.query.includeDeleted === "true"
          ? false
          : true,
    });
    if (!transport) throw new Error("Transport not found");
  });

const reviewIdParam = param("reviewId")
  .isInt()
  .withMessage("Invalid review ID format");

const transportTypeExists = body("transportTypeId")
  .isInt()
  .withMessage("Invalid transport type ID")
  .custom(async (value) => {
    const exists = await TransportType.findByPk(value);
    if (!exists) throw new Error("Transport type not found");
  });

const uniqueTitle = body("title")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Title must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = {
      title: value,
      transportTypeId:
        req.body.transportTypeId || req.transport?.transportTypeId,
      [Op.not]: { id: req.params?.id ? [req.params.id] : [] },
    };
    const exists = await Transport.findOne({ where });
    if (exists) throw new Error("Title already exists for this transport type");
  });

const basicValidations = [
  body("operatorName")
    .trim()
    .notEmpty()
    .withMessage("Operator name is required")
    .isLength({ max: 100 }),

  body("pricePerKmUSD")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 }),

  body("email").optional().trim().isEmail().withMessage("Invalid email format"),

  body("website").optional().trim().isURL().withMessage("Invalid website URL"),

  body("departureCity")
    .trim()
    .notEmpty()
    .withMessage("Departure city is required"),

  body("arrivalCity").trim().notEmpty().withMessage("Arrival city is required"),

  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude (-90 to 90)"),

  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude (-180 to 180)"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),
];

const reviewValidations = [
  body("rating")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("text")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Review must be between 10 and 2000 characters"),

  body("isAnonymous")
    .optional()
    .isBoolean()
    .withMessage("isAnonymous must be a boolean"),
];

const moderateReviewValidation = [
  body("action")
    .isIn(["approve", "reject"])
    .withMessage('Action must be either "approve" or "reject"'),
];

module.exports = {
  create: [transportTypeExists, uniqueTitle, ...basicValidations],

  update: [
    idParam,
    transportTypeExists.optional(),
    uniqueTitle.optional(),
    ...basicValidations.map((validation) => validation.optional()),
  ],

  getById: [idParam],

  delete: [idParam],

  restore: [idParam],

  toggleStatus: [idParam],

  addReview: [idParam, ...reviewValidations],

  getReviews: [
    idParam,
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected", "all"])
      .withMessage("Invalid status value"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],

  moderateReview: [idParam, reviewIdParam, ...moderateReviewValidation],

  list: [
    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be a boolean"),

    query("transportType")
      .optional()
      .isInt()
      .withMessage("transportType must be an integer"),

    query("search")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Search query too long"),

    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),

    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
};
