const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const HomeStay = require("../../models/homeStay.model");
const Amenity = require("../../models/amenity.model");
const HomeStayImage = require("../../models/homestayImage.model");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
      paranoid: false,
    });

    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const homestay = await HomeStay.findOne({
      where: {
        id: value,
        propertyId: {
          [Op.in]: sequelize.literal(`(
            SELECT id FROM properties 
            WHERE merchantId = ${user.merchantProfile.id}
          )`),
        },
      },
      paranoid: false,
    });
    if (!homestay) {
      throw new Error("HomeStay not found or not owned by merchant");
    }
  });

const validateName = body("name")
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage("Name must be 2-100 characters")
  .custom(async (value, { req }) => {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const where = {
      name: value,
      merchantId: user.merchantProfile.id,
    };

    if (req.params?.id) {
      where.id = { [Op.ne]: req.params.id };
    }

    const exists = await HomeStay.findOne({ where });
    if (exists) {
      throw new Error("You already have a homestay with this name");
    }
    return true;
  });

// HomeStay basic validations
const homeStayValidations = [
  body("unitType")
    .isIn([
      "entire_home",
      "private_room",
      "shared_room",
      "guest_suite",
      "villa",
      "cottage",
    ])
    .withMessage("Invalid unit type"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),

  body("maxGuests")
    .isInt({ min: 1, max: 20 })
    .withMessage("Max guests must be between 1-20"),

  body("maxChildren")
    .isInt({ min: 0 })
    .withMessage("Max children must be 0 or more"),

  body("maxInfants")
    .isInt({ min: 0 })
    .withMessage("Max infants must be 0 or more"),

  body("bedroomCount")
    .isInt({ min: 1 })
    .withMessage("Bedroom count must be at least 1"),

  body("bathroomCount")
    .isInt({ min: 1 })
    .withMessage("Bathroom count must be at least 1"),

  body("attachedBathrooms")
    .isInt({ min: 0 })
    .withMessage("Attached bathrooms must be 0 or more"),

  body("sharedBathrooms")
    .isInt({ min: 0 })
    .withMessage("Shared bathrooms must be 0 or more"),

  body("bathroomType")
    .isIn(["private", "shared", "shared_floor", "none"])
    .withMessage("Invalid bathroom type"),

  body("hasHotWater").isBoolean().withMessage("hasHotWater must be a boolean"),

  body("floorNumber")
    .optional()
    .isInt()
    .withMessage("Floor number must be an integer"),

  body("size")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Size must be a positive integer"),

  body("hasKitchen").isBoolean().withMessage("hasKitchen must be a boolean"),

  body("kitchenType")
    .optional()
    .isIn(["full", "partial", "shared", "none"])
    .withMessage("Invalid kitchen type"),

  body("hasLivingRoom")
    .isBoolean()
    .withMessage("hasLivingRoom must be a boolean"),

  body("hasDiningArea")
    .isBoolean()
    .withMessage("hasDiningArea must be a boolean"),

  body("hasBalcony").isBoolean().withMessage("hasBalcony must be a boolean"),

  body("hasGarden").isBoolean().withMessage("hasGarden must be a boolean"),

  body("hasPoolAccess")
    .isBoolean()
    .withMessage("hasPoolAccess must be a boolean"),

  body("basePrice")
    .isDecimal()
    .withMessage("Base price must be a decimal number")
    .custom((value) => value >= 0)
    .withMessage("Base price cannot be negative"),

  body("cleaningFee")
    .isDecimal()
    .withMessage("Cleaning fee must be a decimal number")
    .custom((value) => value >= 0)
    .withMessage("Cleaning fee cannot be negative"),

  body("securityDeposit")
    .isDecimal()
    .withMessage("Security deposit must be a decimal number")
    .custom((value) => value >= 0)
    .withMessage("Security deposit cannot be negative"),

  body("extraGuestFee")
    .isDecimal()
    .withMessage("Extra guest fee must be a decimal number")
    .custom((value) => value >= 0)
    .withMessage("Extra guest fee cannot be negative"),

  body("minimumStay")
    .isInt({ min: 1 })
    .withMessage("Minimum stay must be at least 1 night"),

  body("smokingAllowed")
    .isBoolean()
    .withMessage("smokingAllowed must be a boolean"),

  body("petsAllowed").isBoolean().withMessage("petsAllowed must be a boolean"),

  body("eventsAllowed")
    .isBoolean()
    .withMessage("eventsAllowed must be a boolean"),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean"),

  body("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  body("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  body("rejectionReason")
    .optional()
    .isString()
    .withMessage("Rejection reason must be a string")
    .isLength({ max: 1000 })
    .withMessage("Rejection reason must be less than 1000 characters"),
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

  query("unitType")
    .optional()
    .isIn([
      "entire_home",
      "private_room",
      "shared_room",
      "guest_suite",
      "villa",
      "cottage",
    ])
    .withMessage("Invalid unit type"),

  query("minGuests")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum guests must be at least 1"),

  query("minBedrooms")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum bedrooms must be at least 1"),

  query("minBathrooms")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum bathrooms must be at least 1"),

  query("minPrice")
    .optional()
    .isDecimal()
    .withMessage("Minimum price must be a decimal number"),

  query("maxPrice")
    .optional()
    .isDecimal()
    .withMessage("Maximum price must be a decimal number"),

  query("hasKitchen")
    .optional()
    .isBoolean()
    .withMessage("hasKitchen must be a boolean"),

  query("hasPoolAccess")
    .optional()
    .isBoolean()
    .withMessage("hasPoolAccess must be a boolean"),

  query("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  query("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
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
    .withMessage("sortOrder must be an integer"),
];

const updateAmenitiesValidation = [
  param("id").isInt().withMessage("Invalid homestay ID"),
  body("amenities")
    .isArray({ min: 1 })
    .withMessage("Amenities array cannot be empty"),
  ...amenityValidations,
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid homestay ID"),
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
  param("id").isInt().withMessage("Invalid homestay ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const setFeaturedImageValidation = [
  param("id").isInt().withMessage("Invalid homestay ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const verifyHomeStayValidation = [
  param("id").isInt().withMessage("Invalid homestay ID"),
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
    .withMessage("rejectionReason must be a string"),
];

const updateApprovalStatus = [
  param("id").isInt().withMessage("Invalid homestay ID"),
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
];

// Public homestay ID validation (no merchant ownership check)
const publicIdParam = param("id")
  .isInt()
  .withMessage("Invalid homestay ID format")
  .custom(async (value) => {
    const homestay = await HomeStay.findByPk(value, { paranoid: false });
    if (!homestay) {
      throw new Error("HomeStay not found");
    }
    return true;
  });

module.exports = {
  // Create HomeStay
  create: [
    validateName,
    ...homeStayValidations,
    ...amenityValidations,
    ...imageValidations,
  ],

  // List HomeStays
  list: queryValidations,

  // Get by ID
  getById: [idParam],

  // Update HomeStay
  update: [
    idParam,
    validateName.optional(),
    ...homeStayValidations.map((v) => v.optional()),
    ...amenityValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],

  // Delete HomeStay
  delete: [idParam],

  // Restore HomeStay
  restore: [idParam],

  // Toggle Active Status
  toggleStatus: [idParam],

  // Verify HomeStay
  verify: verifyHomeStayValidation,

  // Update Amenities
  updateAmenities: updateAmenitiesValidation,

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Set Featured Image
  setFeaturedImage: setFeaturedImageValidation,

  /* admin update approval status */
  updateApprovalStatus: updateApprovalStatus,

  /* public homestay ID validation */
  getApprovedHomeStayById: [publicIdParam],
};

exports.updateApprovalStatusValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid homestay ID")
    .custom(async (id) => {
      const homestay = await HomeStay.findByPk(id);
      if (!homestay) throw new Error("Homestay not found");
      return true;
    }),

  body("approvalStatus")
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  body("rejectionReason")
    .if(body("approvalStatus").equals("rejected"))
    .notEmpty()
    .withMessage("Rejection reason is required when status is rejected")
    .isString()
    .withMessage("Rejection reason must be a string")
    .isLength({ max: 1000 })
    .withMessage("Rejection reason must be less than 1000 characters"),
];

exports.toggleVistaVerificationValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid homestay ID")
    .custom(async (id) => {
      const homestay = await HomeStay.findByPk(id);
      if (!homestay) throw new Error("Homestay not found");
      return true;
    }),

  body("verified").isBoolean().withMessage("Verified must be a boolean value"),
];
