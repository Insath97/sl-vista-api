const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const Amenity = require("../../models/amenity.model");
const TransportImage = require("../../models/transportImage.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const transport = await Transport.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!transport) throw new Error("Transport not found");
  });

const transportTypeExists = body("transportTypeId")
  .isInt()
  .withMessage("Invalid transport type ID")
  .custom(async (value) => {
    const exists = await TransportType.findByPk(value);
    if (!exists) throw new Error("Transport type not found");
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
    const exists = await Transport.findOne({ where });
    if (exists) throw new Error("Title already exists");
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

const validateCoordinates = [
  body("latitude")
    .isDecimal()
    .withMessage("Invalid latitude format")
    .custom((value) => {
      if (value < -90 || value > 90)
        throw new Error("Latitude must be between -90 and 90");
      return true;
    }),
  body("longitude")
    .isDecimal()
    .withMessage("Invalid longitude format")
    .custom((value) => {
      if (value < -180 || value > 180)
        throw new Error("Longitude must be between -180 and 180");
      return true;
    }),
];

// Transport basic validations
const transportValidations = [
  body("operatorName")
    .trim()
    .notEmpty()
    .withMessage("Operator name is required")
    .isLength({ max: 100 })
    .withMessage("Operator name must be less than 100 characters"),

  body("pricePerKmUSD")
    .isDecimal({ decimal_digits: "2" })
    .withMessage("Price must be a decimal with 2 digits")
    .isFloat({ min: 0 })
    .withMessage("Price must be positive"),

  body("seatCount")
    .isInt({ min: 1 })
    .withMessage("Seat count must be a positive integer"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isLength({ max: 20 })
    .withMessage("Phone must be less than 20 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid website URL")
    .isLength({ max: 255 })
    .withMessage("Website URL must be less than 255 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

  body("departureCity")
    .trim()
    .notEmpty()
    .withMessage("Departure city is required")
    .isLength({ max: 100 })
    .withMessage("Departure city must be less than 100 characters"),

  body("arrivalCity")
    .trim()
    .notEmpty()
    .withMessage("Arrival city is required")
    .isLength({ max: 100 })
    .withMessage("Arrival city must be less than 100 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid website URL")
    .isLength({ max: 255 })
    .withMessage("Website URL must be less than 255 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),
];

// Query validations
const queryValidations = [
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

  query("transportTypeId")
    .optional()
    .isInt()
    .withMessage("transportTypeId must be an integer"),

  query("amenities")
    .optional()
    .isString()
    .withMessage("Amenities filter must be a comma-separated string of IDs"),

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean"),

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

  query("minSeats")
    .optional()
    .isInt({ min: 1 })
    .withMessage("minSeats must be a positive integer"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("maxPrice must be a positive number"),

  query("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),
];

// Amenity validations
const amenityValidations = [
  body("amenities")
    .optional()
    .customSanitizer((value) => {
      if (typeof value === "string") {
        return value.split(",").map((id) => parseInt(id.trim()));
      }
      return value;
    })
    .custom((value) => {
      if (value && !Array.isArray(value)) {
        throw new Error("Amenities must be an array or comma-separated string");
      }
      return true;
    }),

  body("amenities.*")
    .optional()
    .isInt()
    .withMessage("Amenity ID must be an integer")
    .custom(async (value) => {
      const amenity = await Amenity.findByPk(value);
      if (!amenity) throw new Error(`Amenity with ID ${value} not found`);
      return true;
    }),
];

// Image validations
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

const updateAmenitiesValidation = [
  param("id").isInt().withMessage("Invalid transport ID"),
  body("amenities")
    .isArray({ min: 1 })
    .withMessage("Amenities array cannot be empty"),
  ...amenityValidations,
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid transport ID"),
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
  param("id").isInt().withMessage("Invalid transport ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid transport ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

module.exports = {
  // Create Transport
  create: [
    transportTypeExists,
    validateTitle,
    validateSlug,
    ...validateCoordinates,
    ...transportValidations,
    ...amenityValidations,
    ...imageValidations,
  ],

  // Update Transport
  update: [
    idParam,
    transportTypeExists.optional(),
    validateTitle.optional(),
    validateSlug,
    ...validateCoordinates.map((v) => v.optional()),
    ...transportValidations.map((v) => v.optional()),
    ...amenityValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],

  // Get by ID
  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
  ],

  // Delete Transport
  delete: [idParam],

  // List Transports
  list: queryValidations,

  // Toggle Active Status
  toggleStatus: [idParam],

  // Restore Soft-deleted Transport
  restore: [idParam],

  // Update Amenities
  updateAmenities: updateAmenitiesValidation,

  // Verify Transport
  verify: [
    idParam,
    body("verified")
      .optional()
      .isBoolean()
      .withMessage("verified must be a boolean"),
  ],

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Set Featured Image
  setFeaturedImage: setFeaturedImageValidation,
};
