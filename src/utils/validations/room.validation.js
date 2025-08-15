const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Room = require("../../models/room.model");
const Property = require("../../models/property.model");
const RoomType = require("../../models/roomType.model");
const Amenity = require("../../models/amenity.model");
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

const validateMerchantOwnership = async (roomId, userId) => {
  const merchant = await MerchantProfile.findOne({
    where: { userId },
    attributes: ["id", "businessType"],
  });

  if (!merchant) {
    throw new Error("Merchant profile not found");
  }

  if (["homestay"].includes(merchant.businessType)) {
    throw new Error("Your business type does not allow room management");
  }

  const room = await Room.findOne({
    where: {
      id: roomId,
    },
    include: [
      {
        model: Property,
        as: "property",
        where: { merchantId: merchant.id },
      },
    ],
  });

  if (!room) {
    throw new Error("Room not found or not owned by your merchant account");
  }

  return true;
};

// Room ID validation with ownership and business type check
const roomIdParam = param("id")
  .isInt({ min: 1 })
  .withMessage("Invalid room ID format")
  .toInt()
  .custom(async (value, { req }) => {
    if (req.user.accountType === "admin") {
      const room = await Room.findByPk(value, { paranoid: false });
      if (!room) throw new Error("Room not found");
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

    if (["homestay"].includes(merchant.businessType)) {
      throw new Error("Your business type does not allow room access");
    }
  }
  return true;
});

// Room basic validations
const roomValidations = [
  businessTypeAccessValidation,

  body("propertyId")
    .isInt()
    .withMessage("Invalid property ID")
    .custom(async (value, { req }) => {
      const property = await Property.findByPk(value);
      if (!property) throw new Error("Property not found");

      if (req.user.accountType === "merchant") {
        const merchant = await MerchantProfile.findOne({
          where: { userId: req.user.id },
        });
        if (!merchant || property.merchantId !== merchant.id) {
          throw new Error("Property not owned by merchant");
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

  body("roomNumber")
    .trim()
    .notEmpty()
    .withMessage("Room number is required")
    .isLength({ max: 20 })
    .withMessage("Room number must be less than 20 characters")
    .custom(async (value, { req }) => {
      const where = {
        roomNumber: value,
        propertyId: req.body.propertyId,
      };

      if (req.params?.id) {
        where.id = { [Op.ne]: req.params.id };
      }

      const exists = await Room.findOne({ where });
      if (exists)
        throw new Error("Room number already exists in this property");
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
    .withMessage("isActive must be a boolean value")
    .toBoolean(),

  body("vistaVerified")
    .optional()
    .isBoolean()
    .withMessage("vistaVerified must be a boolean value")
    .toBoolean(),

  body("approvalStatus")
    .optional()
    .custom((value, { req }) => {
      if (value && req.user.accountType !== "admin") {
        throw new Error("Only admins can set approval status");
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

// Status validations
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

// Image validations
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
        throw new Error("Your business type does not allow room access");
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

  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean")
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

  query("includeProperty")
    .optional()
    .isBoolean()
    .withMessage("includeProperty must be a boolean")
    .toBoolean(),

  query("approvalStatus")
    .optional()
    .isIn(["pending", "approved", "rejected", "changes_requested"])
    .withMessage("Invalid approval status"),

  query("availabilityStatus")
    .optional()
    .isIn(["available", "unavailable", "maintenance", "archived"])
    .withMessage("Invalid availability status"),

  query("cleaningStatus")
    .optional()
    .isIn(["Clean", "Dirty", "In Progress", "Maintenance"])
    .withMessage("Invalid cleaning status"),

  query("sortBy")
    .optional()
    .isIn([
      "createdAt",
      "updatedAt",
      "roomNumber",
      "basePrice",
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
  // Create Room
  create: [
    ...roomValidations,
    ...amenityValidations,
    ...imageValidations,
    ...statusValidations,
  ],

  // List Rooms
  list: queryValidations,

  // Get by ID
  getById: [roomIdParam],

  // Update Room
  update: [
    roomIdParam,
    ...roomValidations.map((v) => v.optional()),
    ...amenityValidations.map((v) => v.optional()),
    ...imageValidations.map((v) => v.optional()),
    ...statusValidations.map((v) => v.optional()),
  ],

  // Delete Room
  delete: [roomIdParam],

  // Restore Room
  restore: [roomIdParam],

  // Verify Room
  verify: [
    roomIdParam,
    body("verified")
      .optional()
      .isBoolean()
      .withMessage("verified must be a boolean")
      .toBoolean(),
  ],

  // Update Status
  updateStatus: [
    roomIdParam,
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean")
      .toBoolean(),
  ],

  // Update Availability Status
  updateAvailability: [
    roomIdParam,
    body("availabilityStatus")
      .isIn(["available", "unavailable", "maintenance", "archived"])
      .withMessage("Invalid availability status"),
  ],

  // Update Approval Status
  updateApproval: [
    roomIdParam,
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

};
