const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Property = require("../../models/property.model");
const Amenity = require("../../models/amenity.model");
const PropertyImage = require("../../models/propertyImage.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Common validation helpers
const validateIdParam = (paramName, model, options = {}) => {
  return param(paramName)
    .isInt({ min: 1 })
    .withMessage(`Invalid ${paramName} format`)
    .toInt()
    .custom(async (value, { req }) => {
      const record = await model.findByPk(value, options);
      if (!record) {
        throw new Error(`${model.name} not found`);
      }
      return true;
    });
};

const validateMerchantOwnership = async (propertyId, userId) => {
  const merchant = await MerchantProfile.findOne({
    where: { userId },
    attributes: ["id", "businessType"],
  });

  if (!merchant) {
    throw new Error("Merchant profile not found");
  }

  // Check business type restrictions
  if (["homestay"].includes(merchant.businessType)) {
    throw new Error("Your business type does not allow property management");
  }

  const property = await Property.findOne({
    where: {
      id: propertyId,
      merchantId: merchant.id,
    },
  });

  if (!property) {
    throw new Error("Property not found or not owned by your merchant account");
  }

  return true;
};

// Property ID validation with ownership and business type check
const propertyIdParam = param("id")
  .isInt({ min: 1 })
  .withMessage("Invalid property ID format")
  .toInt()
  .custom(async (value, { req }) => {
    if (req.user.accountType === "admin") {
      const property = await Property.findByPk(value, { paranoid: false });
      if (!property) throw new Error("Property not found");
      return true;
    }

    return validateMerchantOwnership(value, req.user.id);
  });

// Business type access validation
const businessTypeAccessValidation = body().custom(async (value, { req }) => {
  if (req.user?.accountType === "merchant") {
    const merchant = await MerchantProfile.findOne({
      where: { userId: req.user.id },
      attributes: ["businessType"],
    });

    if (!merchant) {
      throw new Error("Merchant profile not found");
    }

    if (merchant.businessType === 'homestay') {
      throw new Error("Your business type does not allow property access");
    }
  }
  return true;
});

// Property basic validations
const propertyValidations = [
  businessTypeAccessValidation,

  body("propertyType")
    .isIn(["hotel", "homestay", "apartment", "resort", "villa"])
    .withMessage("Invalid property type"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be 2-100 characters")
    .custom(async (value, { req }) => {
      const where = {
        title: { [Op.like]: value }, // Changed from Op.iLike to Op.like
      };

      if (req.params?.id) {
        where.id = { [Op.ne]: req.params.id };
      }
      if (req.user.accountType === "merchant") {
        const merchant = await MerchantProfile.findOne({
          where: { userId: req.user.id },
          attributes: ["id"],
        });
        if (!merchant) throw new Error("Merchant profile not found");
        where.merchantId = merchant.id;
      } else if (req.body.merchantId) {
        where.merchantId = req.body.merchantId;
      }

      const exists = await Property.findOne({ where });
      if (exists) {
        throw new Error("This title is already in use for this merchant");
      }
      return true;
    }),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Slug can only contain lowercase letters, numbers and hyphens")
    .isLength({ max: 100 })
    .withMessage("Slug must be less than 100 characters")
    .custom(async (value, { req }) => {
      const exists = await Property.findOne({
        where: {
          slug: value,
          [Op.ne]: req.params?.id ? { id: req.params.id } : undefined,
        },
      });
      if (exists) throw new Error("This slug is already in use");
      return true;
    }),

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

  body("district")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  body("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  body("country")
    .optional()
    .default("Sri Lanka")
    .trim()
    .isLength({ max: 50 })
    .withMessage("Country must be less than 50 characters"),

  body("postalCode")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Postal code must be less than 20 characters"),

  body("cancellationPolicy")
    .isIn(["flexible", "moderate", "strict", "non_refundable"])
    .withMessage("Invalid cancellation policy")
    .default("moderate"),

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
    .withMessage("Invalid check-in time format (HH:MM)")
    .default("14:00"),

  body("checkOutTime")
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid check-out time format (HH:MM)")
    .default("12:00"),

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

  body("facebookUrl")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid Facebook URL"),

  body("instagramUrl")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid Instagram URL"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value")
    .toBoolean(),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value")
    .toBoolean(),

  body("merchantId")
    .if((value, { req }) => req.user.accountType === "admin")
    .notEmpty()
    .withMessage("merchantId is required for admin")
    .isInt()
    .withMessage("merchantId must be an integer")
    .custom(async (value) => {
      const merchant = await MerchantProfile.findByPk(value);
      if (!merchant) throw new Error("Merchant not found");
      return true;
    }),
];

// Status validations (unchanged)
const statusValidations = [
  body("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  body("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  body("rejectionReason")
    .optional()
    .isString()
    .withMessage("Rejection reason must be a string")
    .isLength({ max: 1000 })
    .withMessage("Rejection reason must be less than 1000 characters")
    .custom((value, { req }) => {
      if (req.body.approvalStatus === "rejected" && !value) {
        throw new Error("Rejection reason is required when status is rejected");
      }
      return true;
    }),
];

// Amenity validations (unchanged)
const amenityValidations = [
  body("amenities")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === "string" && value.split(",").every((v) => !isNaN(v)))
        return true;
      throw new Error(
        "Amenities must be an array or comma-separated string of numbers"
      );
    })
    .customSanitizer((value) => {
      if (typeof value === "string") {
        return value.split(",").map((id) => parseInt(id.trim()));
      }
      return value;
    }),

  body("amenities.*")
    .isInt()
    .withMessage("Amenity ID must be an integer")
    .custom(async (value) => {
      const amenity = await Amenity.findByPk(value);
      if (!amenity) throw new Error(`Amenity with ID ${value} not found`);
      return true;
    }),
];

// Image validations (unchanged)
const imageValidations = [
  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*.imageUrl")
    .if(body("images.*.imageUrl").exists())
    .isURL()
    .withMessage("Image URL must be a valid URL")
    .isLength({ max: 512 })
    .withMessage("Image URL must be less than 512 characters"),

  body("images.*.s3Key")
    .optional()
    .isString()
    .withMessage("S3 key must be a string"),

  body("images.*.fileName")
    .optional()
    .isString()
    .withMessage("File name must be a string"),

  body("images.*.size")
    .optional()
    .isInt()
    .withMessage("File size must be an integer"),

  body("images.*.mimetype")
    .optional()
    .isString()
    .withMessage("MIME type must be a string"),

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

// Query validations with business type check
const queryValidations = [
  query().custom(async (value, { req }) => {
    if (req.user?.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
        attributes: ["businessType"],
      });

      if (!merchant) {
        throw new Error("Merchant profile not found");
      }

      if (["homestay"].includes(merchant.businessType)) {
        throw new Error("Your business type does not allow property access");
      }
    }
    return true;
  }),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt()
    .default(1),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt()
    .default(10),

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

  query("district")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("District must be less than 50 characters"),

  query("province")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Province must be less than 50 characters"),

  query("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  query("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),

  query("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean")
    .toBoolean(),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean")
    .toBoolean(),

  query("includeImages")
    .optional()
    .isBoolean()
    .withMessage("includeImages must be a boolean")
    .toBoolean(),

  query("includeAmenities")
    .optional()
    .isBoolean()
    .withMessage("includeAmenities must be a boolean")
    .toBoolean(),

  query("includeMerchant")
    .optional()
    .isBoolean()
    .withMessage("includeMerchant must be a boolean")
    .toBoolean(),

  query("sortBy")
    .optional()
    .isIn([
      "createdAt",
      "updatedAt",
      "title",
      "city",
      "propertyType",
      "approvalStatus",
      "vistaVerified",
    ])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'")
    .default("desc"),
];

// Export all validations with business type checks
module.exports = {
  // Create Property
  create: [
    ...propertyValidations,
    ...amenityValidations,
    ...imageValidations,
    ...statusValidations,
  ],

  // List Properties
  list: queryValidations,

  // Get by ID
  getById: [propertyIdParam],

  // Update Property
  update: [
    propertyIdParam,
    ...propertyValidations.map((v) => v.optional()),
    ...amenityValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
    ...statusValidations.map((v) => v.optional()),
  ],

  // Delete Property
  delete: [propertyIdParam],

  // Restore Property
  restore: [propertyIdParam],

  // Verify Property
  verify: [
    propertyIdParam,
    body("verified")
      .optional()
      .isBoolean()
      .withMessage("verified must be a boolean")
      .toBoolean(),
  ],

  // Update Status
  updateStatus: [
    propertyIdParam,
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean")
      .toBoolean(),
  ],

  // Update Availability Status
  updateAvailability: [
    propertyIdParam,
    body("availabilityStatus")
      .isIn(["available", "unavailable", "maintenance", "archived"])
      .withMessage("Invalid availability status"),
  ],

  // Update Approval Status
  updateApproval: [
    propertyIdParam,
    body("approvalStatus")
      .isIn(["pending", "approved", "rejected", "changes_requested"])
      .withMessage("Invalid approval status"),
    body("rejectionReason")
      .if(body("approvalStatus").equals("rejected"))
      .notEmpty()
      .withMessage("Rejection reason is required when status is rejected")
      .optional()
      .isString()
      .withMessage("Rejection reason must be a string")
      .isLength({ max: 1000 })
      .withMessage("Rejection reason must be less than 1000 characters"),
  ],
  /* 
  // Image operations
  addImages: [propertyIdParam],
  updateImages: [propertyIdParam, ...imageValidations],
  deleteImage: imageOperationValidations,
  setFeaturedImage: imageOperationValidations, */

  // Amenity operations
  updateAmenities: [
    propertyIdParam,
    body("amenities")
      .isArray({ min: 1 })
      .withMessage("Amenities array cannot be empty"),
    ...amenityValidations,
  ],

  // Public property ID validation (no ownership check)
  publicGetById: [
    validateIdParam("id", Property, {
      paranoid: false,
      where: {
        isActive: true,
        approvalStatus: "approved",
      },
    }),
  ],
};
