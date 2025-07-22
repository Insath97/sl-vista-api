const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const User = require("../../models/user.model");
const Role = require("../../models/role.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const user = await User.findOne({
      where: { id: value, accountType: "admin" },
      paranoid: false, // This is crucial for restore functionality
    });
    if (!user) throw new Error("Admin user not found");
    return true;
  });

const validateEmail = body("email")
  .trim()
  .isEmail()
  .withMessage("Invalid email format")
  .isLength({ max: 100 })
  .withMessage("Email must be less than 100 characters")
  .custom(async (value, { req }) => {
    const where = {
      email: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await User.findOne({ where, paranoid: false });
    if (exists) throw new Error("Email already in use");
    return true;
  });

const validatePassword = body("password")
  .optional()
  .isLength({ min: 8, max: 128 })
  .withMessage("Password must be 8-128 characters");

const validateRoleId = body("roleId")
  .optional()
  .isInt()
  .withMessage("Role ID must be an integer")
  .custom(async (value) => {
    if (value) {
      const role = await Role.findOne({
        where: {
          id: value,
          userType: "admin",
        },
      });
      if (!role) throw new Error("Role is invalid or not an admin role");
    }
    return true;
  });

const validateProfile = [
  body("fullName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be 2-100 characters"),

  body("mobileNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Mobile number must be less than 20 characters"),

  body("isSuperAdmin")
    .optional()
    .isBoolean()
    .withMessage("isSuperAdmin must be a boolean")
    .custom((value, { req }) => {
      if (value && req.user.accountType !== "admin") {
        throw new Error("Only system admins can set super admin status");
      }
      return true;
    }),
];

// Query validations
const queryValidations = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

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
];

module.exports = {
  // Create Admin User
  create: [validateEmail, validatePassword, validateRoleId, ...validateProfile],

  // List Admin Users
  list: queryValidations,

  // Get by ID
  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
  ],

  // Update Admin User
  update: [
    idParam,
    validateEmail.optional(),
    validatePassword,
    validateRoleId,
    ...validateProfile.map((v) => v.optional()),
  ],

  // Delete Admin User
  delete: [idParam],

  // Restore Admin User
  restore: [idParam],

  // Toggle Status
  toggleStatus: [
    idParam,
    body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  ],
};
