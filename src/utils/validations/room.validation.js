const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Room = require("../../models/room.model");
const Property = require("../../models/property.model");
const RoomType = require("../../models/roomType.model");
const Amenity = require("../../models/amenity.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    // Admin can access any room
    if (req.user.accountType === "admin") return true;

    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
      paranoid: false,
    });

    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const room = await Room.findOne({
      where: { id: value },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
      paranoid: false,
    });

    if (!room) {
      throw new Error("Room not found or not owned by merchant");
    }
  });

const validateRoomNumber = body("roomNumber")
  .trim()
  .isLength({ min: 1, max: 20 })
  .withMessage("Room number must be 1-20 characters")
  .custom(async (value, { req }) => {
    const where = {
      roomNumber: value,
      propertyId: req.body.propertyId || req.params.propertyId,
    };

    if (req.params?.id) {
      where.id = { [Op.ne]: req.params.id };
    }

    const exists = await Room.findOne({ where });
    if (exists) {
      throw new Error("Room number already exists in this property");
    }
    return true;
  });

// Room basic validations
const roomValidations = [
  body("propertyId")
    .isInt()
    .withMessage("Invalid property ID")
    .custom(async (value, { req }) => {
      // Admin can assign to any property
      if (req.user.accountType === "admin") return true;

      if (req.user.accountType === "merchant") {
        const property = await Property.findOne({
          where: {
            id: value,
            merchantId: req.user.merchantProfile.id,
          },
        });
        if (!property) {
          throw new Error("Property not found or not owned by merchant");
        }
      }
      return true;
    }),

  body("roomTypeId")
    .isInt()
    .withMessage("Invalid room type ID")
    .custom(async (value) => {
      const roomType = await RoomType.findByPk(value);
      if (!roomType) throw new Error("Room type not found");
      return true;
    }),

  body("basePrice")
    .isFloat({ min: 0 })
    .withMessage("Base price must be a positive number"),

  body("floor")
    .optional()
    .isString()
    .withMessage("Floor must be a string")
    .isLength({ max: 10 })
    .withMessage("Floor must be less than 10 characters"),

  body("maxOccupancy")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max occupancy must be at least 1"),

  body("sizeSqft")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Size must be a positive number"),

  body("bedConfiguration")
    .optional()
    .isIn([
      "1 Single Bed",
      "1 Double Bed",
      "2 Single Beds",
      "1 Double + 1 Single",
      "Other",
    ])
    .withMessage("Invalid bed configuration"),

  body("bedroomCount")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Bedroom count must be at least 1"),

  body("bathroomCount")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Bathroom count cannot be negative"),

  body("viewType")
    .optional()
    .isIn(["Sea", "Garden", "City", "Mountain", "Pool", "None"])
    .withMessage("Invalid view type"),

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
    .custom(async (value, { req }) => {
      // Only admin can set approval status directly
      if (value && req.user.accountType !== "admin") {
        throw new Error("Only admin can set approval status");
      }
      return true;
    })
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  body("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  body("cleaningStatus")
    .optional()
    .isIn(["Clean", "Dirty", "In Progress", "Maintenance"])
    .withMessage("Invalid cleaning status"),
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

  query("includeProperty")
    .optional()
    .isBoolean()
    .withMessage("includeProperty must be a boolean"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("propertyId").optional().isInt().withMessage("Invalid property ID"),

  query("roomTypeId").optional().isInt().withMessage("Invalid room type ID"),

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum price must be a positive number"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum price must be a positive number"),

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
  param("id").isInt().withMessage("Invalid room ID"),
  body("amenities")
    .isArray({ min: 1 })
    .withMessage("Amenities array cannot be empty"),
  ...amenityValidations,
];

const updateImagesValidation = [
  param("id").isInt().withMessage("Invalid room ID"),
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
  param("id").isInt().withMessage("Invalid room ID"),
  param("imageId").isInt().withMessage("Invalid image ID"),
];

const verifyRoomValidation = [
  param("id").isInt().withMessage("Invalid room ID"),
  body("verified")
    .optional()
    .isBoolean()
    .withMessage("verified must be a boolean")
    .custom((value, { req }) => {
      if (req.user.accountType !== "admin") {
        throw new Error("Only admin can perform Vista verification");
      }
      return true;
    }),
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
  param("id").isInt().withMessage("Invalid room ID"),
  body("approvalStatus")
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status")
    .custom((value, { req }) => {
      if (req.user.accountType !== "admin") {
        throw new Error("Only admin can update approval status");
      }
      return true;
    }),
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

// Public room ID validation (no merchant ownership check)
const publicIdParam = param("id")
  .isInt()
  .withMessage("Invalid room ID format")
  .custom(async (value) => {
    const room = await Room.findByPk(value, { paranoid: false });
    if (!room) {
      throw new Error("Room not found");
    }
    return true;
  });

// Vista verification validation (admin only)
const vistaVerifyValidation = [
  param("id").isInt().withMessage("Invalid room ID"),
  body("vistaVerified")
    .isBoolean()
    .withMessage("vistaVerified must be a boolean")
    .custom((value, { req }) => {
      if (req.user.accountType !== "admin") {
        throw new Error("Only admin can perform Vista verification");
      }
      return true;
    }),
];

module.exports = {
  // Create Room
  create: [
    validateRoomNumber,
    ...roomValidations,
    ...amenityValidations,
    ...imageValidations,
  ],

  // List Rooms
  list: queryValidations,

  // Get by ID
  getById: [idParam],

  // Update Room
  update: [
    idParam,
    validateRoomNumber.optional(),
    ...roomValidations.map((v) => v.optional()),
    ...amenityValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
  ],

  // Delete Room
  delete: [idParam],

  // Restore Room
  restore: [idParam],

  // Toggle Active Status
  toggleStatus: [idParam],

  // Verify Room
  verify: verifyRoomValidation,

  // Vista Verify (admin only)
  vistaVerify: vistaVerifyValidation,

  // Update Amenities
  updateAmenities: updateAmenitiesValidation,

  // Update Images
  updateImages: updateImagesValidation,

  // Delete Image
  deleteImage: deleteImageValidation,

  // Admin update approval status
  updateApprovalStatus: updateApprovalStatus,

  // Public room ID validation
  getApprovedRoomById: [publicIdParam],
};
