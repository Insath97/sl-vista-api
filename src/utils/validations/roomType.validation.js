const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const RoomType = require("../../models/roomType.model");

// Common validation helpers
const validateIdParam = param("id")
  .isInt({ min: 1 })
  .withMessage("Invalid ID format")
  .toInt()
  .custom(async (value, { req }) => {
    const roomType = await RoomType.findByPk(value, { paranoid: false });
    if (!roomType) {
      throw new Error("Room type not found");
    }
    return true;
  });

const validateName = body("name")
  .trim()
  .notEmpty()
  .withMessage("Name is required")
  .isLength({ min: 2, max: 100 })
  .withMessage("Name must be 2-100 characters")
  .custom(async (value, { req }) => {
    const where = { 
      name: { [Op.like]: value }  // Changed from Op.iLike to Op.like
    };

    if (req.params?.id) {
      where.id = { [Op.ne]: req.params.id };
    }

    const exists = await RoomType.findOne({ where });
    if (exists) {
      throw new Error("Room type with this name already exists");
    }
    return true;
  });

// Room Type validations
const roomTypeValidations = [
  validateName,
  
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value")
    .toBoolean(),
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
  
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),
  
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
];

module.exports = {
  // Create Room Type
  create: roomTypeValidations,
  
  // List Room Types
  list: queryValidations,
  
  // Get by ID
  getById: [validateIdParam],
  
  // Update Room Type
  update: [
    validateIdParam,
    ...roomTypeValidations.map(v => v.optional())
  ],
  
  // Delete Room Type
  delete: [validateIdParam],
  
  // Restore Room Type
  restore: [validateIdParam],
  
  // Toggle Active Status
  toggleStatus: [
    validateIdParam,
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean")
      .toBoolean(),
  ],
};