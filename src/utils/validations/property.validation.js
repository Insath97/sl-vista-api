const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Property = require("../../models/property.model");
const Amenity = require("../../models/amenity.model");
const PropertyImage = require("../../models/propertyImage.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
      paranoid: false
    });

    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const property = await Property.findOne({
      where: {
        id: value,
        merchantId: user.merchantProfile.id
      },
      paranoid: false
    });
    if (!property) {
      throw new Error("Property not found or not owned by merchant");
    }
  });

const validateTitle = body("title")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Title must be 2-100 characters")
  .custom(async (value, { req }) => {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }]
    });

    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const where = {
      title: value,
      merchantId: user.merchantProfile.id
    };

    if (req.params?.id) {
      where.id = { [Op.ne]: req.params.id };
    }

    const exists = await Property.findOne({ where });
    if (exists) {
      throw new Error("You already have a property with this title");
    }
    return true;
  });

const validateSlug = body("slug")
  .optional()
  .trim()
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
  .isLength({ max: 100 })
  .withMessage("Slug must be less than 100 characters");

// Property basic validations
const propertyValidations = [
  body("propertyType")
    .isIn(["hotel", "homestay", "apartment", "resort", "villa"])
    .withMessage("Invalid property type"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 10, max: 255 })
    .withMessage("Address must be between 10-255 characters"),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  body("state")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("State must be less than 50 characters"),

  body("country")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Country must be less than 50 characters"),

  body("postalCode")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Postal code must be less than 20 characters"),

  body("starRating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Star rating must be between 1-5"),

  body("cancellationPolicy")
    .isIn(["flexible", "moderate", "strict", "non_refundable"])
    .withMessage("Invalid cancellation policy"),

  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),

  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),

  body("checkInTime")
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid check-in time format (HH:MM)"),

  body("checkOutTime")
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid check-out time format (HH:MM)"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

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

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value"),

  body("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  body("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status")
];

// Query validations
const queryValidations = [
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean"),

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean"),

  query("includeAmenities")
    .optional()
    .isBoolean()
    .withMessage("includeAmenities must be a boolean"),

  query("includeMerchant")
    .optional()
    .isBoolean()
    .withMessage("includeMerchant must be a boolean"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("propertyType")
    .optional()
    .isIn(["hotel", "homestay", "apartment", "resort", "villa"])
    .withMessage("Invalid property type"),

  query("city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City must be less than 50 characters"),

  query("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  query("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
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
    })
];

// Image validations
const imageValidations = [
  body("images")
    .optional()
    .isArray()
    .withMessage("Images must be an array"),

  body("images.*.imageUrl")
    .optional()
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
    .withMessage("sortOrder must be an integer")
];

const updateAmenitiesValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid property ID"),
  body("amenities")
    .isArray({ min: 1 })
    .withMessage("Amenities array cannot be empty"),
  ...amenityValidations
];

const updateImagesValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid property ID"),
  body("images")
    .isArray({ min: 1 })
    .withMessage("Images array cannot be empty"),
  ...imageValidations,
  body("images.*.id")
    .optional()
    .isInt()
    .withMessage("Image ID must be an integer")
];

const deleteImageValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid property ID"),
  param("imageId")
    .isInt()
    .withMessage("Invalid image ID")
];

const setFeaturedImageValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid property ID"),
  param("imageId")
    .isInt()
    .withMessage("Invalid image ID")
];

const verifyPropertyValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid property ID"),
  body("verified")
    .optional()
    .isBoolean()
    .withMessage("verified must be a boolean"),
  body("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),
  body("rejectionReason")
    .optional()
    .isString()
    .withMessage("rejectionReason must be a string")
];

const updateApprovalStatus = [
  param('id')
    .isInt()
    .withMessage('Invalid property ID'),
  body('approvalStatus')
    .isIn(['pending', 'approved', 'rejected', 'changes_requested'])
    .withMessage('Invalid approval status'),
  body('rejectionReason')
    .if(body('approvalStatus').equals('rejected'))
    .notEmpty()
    .withMessage('Rejection reason is required when status is rejected')
    .optional()
    .isString()
    .withMessage('Rejection reason must be a string')
    .isLength({ max: 1000 })
    .withMessage('Rejection reason must be less than 1000 characters')
];

module.exports = {
  // Create Property
  create: [
    validateTitle,
    validateSlug,
    ...propertyValidations,
    ...amenityValidations,
    ...imageValidations
  ],

  // List Properties
  list: queryValidations,

  // Get by ID
  getById: [idParam],

  // Update Property
  update: [
    idParam,
    validateTitle.optional(),
    validateSlug,
    ...propertyValidations.map(v => v.optional()),
    ...amenityValidations.map(v => v.optional()),
    ...imageValidations.map(v => v.optional())
  ],

  // Delete Property
  delete: [idParam],

  // Restore Property
  restore: [idParam],

  // Toggle Active Status
  toggleStatus: [idParam],

  // Verify Property
  verify: verifyPropertyValidation,

  // Update Amenities
  updateAmenities: updateAmenitiesValidation,

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Set Featured Image
  setFeaturedImage: setFeaturedImageValidation,

  /* admin update approval status */
  updateApprovalStatus: updateApprovalStatus
};