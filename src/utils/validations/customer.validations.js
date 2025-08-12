const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const User = require("../../models/user.model");
const CustomerProfile = require("../../models/customerProfile.model");

// Utility functions
const isAdmin = (req) => req.user?.accountType === "admin";

// Reusable validation helpers
const validateIdParam = (paramName, model, options = {}) => {
  return param(paramName)
    .isInt({ min: 1 })
    .withMessage(`Invalid ${paramName} format`)
    .toInt()
    .custom(async (value, { req }) => {
      const record = await model.findByPk(value, options);
      if (!record) throw new Error(`${model.name} not found`);
      req[`${model.name.toLowerCase()}Record`] = record; // Attach to request for later use
      return true;
    });
};

const validateOwnership = async (customerId, userId) => {
  const customer = await CustomerProfile.findOne({
    where: { userId },
    attributes: ["id"],
  });

  if (!customer) throw new Error("Customer profile not found");
  if (customer.id !== parseInt(customerId)) {
    throw new Error("Unauthorized access to customer profile");
  }
  return true;
};

// Enhanced customer ID validation
const customerIdParam = validateIdParam("id", CustomerProfile, { paranoid: false })
  .custom(async (value, { req }) => {
    if (!isAdmin(req)) {
      await validateOwnership(value, req.user.id);
    }
    return true;
  });

// Password validation (reusable)
const passwordValidation = (field = "password", isOptional = false) => {
  const validator = body(field)
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be 8-128 characters")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain at least one special character");

  return isOptional ? validator.optional() : validator.notEmpty().withMessage("Password is required");
};

// Name validation (reusable)
const nameValidation = (field, label, isOptional = false) => {
  const validator = body(field)
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage(`${label} must be 2-50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${label} contains invalid characters`);

  return isOptional ? validator.optional() : validator.notEmpty().withMessage(`${label} is required`);
};

// Email validation (reusable)
const emailValidation = (isOptional = false) => {
  const validator = body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .custom(async (value, { req }) => {
      const where = { email: value };
      
      // For updates, exclude current user's email
      if (req.params?.id) {
        const customer = req.customerprofilerecord || await CustomerProfile.findByPk(req.params.id);
        if (!customer) throw new Error("Customer not found");
        where[Op.not] = { id: customer.userId };
      }

      const exists = await User.findOne({ where });
      if (exists) throw new Error("Email already in use");
      return true;
    });

  return isOptional ? validator.optional() : validator.notEmpty().withMessage("Email is required");
};

// Mobile number validation (reusable)
const mobileValidation = (isOptional = false) => {
  const validator = body("mobileNumber")
    .trim()
    .matches(/^\+?[\d\s-]{10,15}$/)
    .withMessage("Invalid mobile number format")
    .custom(async (value, { req }) => {
      const where = { mobileNumber: value };
      
      // For updates, exclude current customer's mobile
      if (req.params?.id) {
        const customer = req.customerprofilerecord || await CustomerProfile.findByPk(req.params.id);
        if (!customer) throw new Error("Customer not found");
        where[Op.not] = { id: customer.id };
      }

      const exists = await CustomerProfile.findOne({ where });
      if (exists) throw new Error("Mobile number already in use");
      return true;
    });

  return isOptional ? validator.optional() : validator.notEmpty().withMessage("Mobile number is required");
};

// Customer registration validations
const registerValidations = [
  emailValidation(),
  passwordValidation(),
  nameValidation("firstName", "First name"),
  nameValidation("lastName", "Last name"),
  mobileValidation(),
];

// Customer profile update validations
const updateValidations = [
  emailValidation(true),
  passwordValidation("password", true),
  nameValidation("firstName", "First name", true),
  nameValidation("lastName", "Last name", true),
  mobileValidation(true),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
];

// Enhanced query validations for listing customers
const queryValidations = [
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

  query("sortBy")
    .optional()
    .isIn([
      "createdAt", "updatedAt", "firstName", 
      "lastName", "email", "mobileNumber"
    ])
    .withMessage("Invalid sort field")
    .default("createdAt"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'")
    .default("desc"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long")
    .customSanitizer(value => value?.replace(/[^\w\s-]/gi, '')), // Basic sanitization

  // Admin-only filters
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean")
    .toBoolean()
    .custom((value, { req }) => {
      if (value && !isAdmin(req)) {
        throw new Error("Only admins can view inactive customers");
      }
      return true;
    }),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean")
    .toBoolean()
    .custom((value, { req }) => {
      if (value && !isAdmin(req)) {
        throw new Error("Only admins can view deleted customers");
      }
      return true;
    }),
];

// Export all validations
module.exports = {
  // Register Customer
  register: registerValidations,

  // Update Customer (with ownership check)
  update: [
    customerIdParam,
    ...updateValidations,
    body().custom((value, { req }) => {
      if (Object.keys(value).length === 0) {
        throw new Error("At least one field must be provided for update");
      }
      return true;
    })
  ],

  // List Customers (Admin only)
  list: [
    queryValidations,
    query().custom((value, { req }) => {
      if (!isAdmin(req)) {
        throw new Error("Only admins can list customers");
      }
      return true;
    })
  ],

  // Get Customer by ID (with ownership check)
  getById: [customerIdParam],

  // Deactivate Customer (Admin only)
  deactivate: [
    customerIdParam,
    query().custom((value, { req }) => {
      if (!isAdmin(req)) {
        throw new Error("Only admins can deactivate customers");
      }
      return true;
    })
  ],

  // Public customer profile view (no sensitive data)
  publicGetById: [
    validateIdParam("id", CustomerProfile, {
      paranoid: false,
      include: [{
        model: User,
        as: "user",
        attributes: ["id", "email", "isActive", "createdAt"],
        where: { isActive: true }
      }],
      attributes: { exclude: ["userId", "deletedAt"] }
    })
  ],

  // Validation utilities for reuse in other files
  utilities: {
    validateIdParam,
    isAdmin,
    passwordValidation,
    nameValidation,
    emailValidation,
    mobileValidation
  }
};