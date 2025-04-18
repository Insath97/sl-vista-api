const { body } = require("express-validator");
const User = require("../../models/user.model");
const AdminProfile = require("../../models/adminProfile.model");

exports.createAdminValidation = [
  // Full Name validation
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be 2-100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Full name contains invalid characters"),

  // Email validation
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .custom(async (email) => {
      const exists = await User.findOne({ where: { email } });
      if (exists) throw new Error("Email already exists");
    }),

  // Password validation
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Must contain at least one number")
    .matches(/[!@#$%^&*]/)
    .withMessage("Must contain at least one special character"),

  // Mobile number validation
  body("mobileNumber")
    .optional()
    .trim()
    .matches(/^\+?[\d\s-]+$/)
    .withMessage("Invalid phone number format"),
];

exports.updateAdminValidation = [
  // Full Name validation (optional for updates)
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be 2-100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Full name contains invalid characters"),

  // Email validation (optional for updates)
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .custom(async (email, { req }) => {
      if (email) {
        const user = await User.findOne({ where: { email } });
        if (user && user.id !== parseInt(req.params.id)) {
          throw new Error("Email already in use by another user");
        }
      }
    }),

  // Password validation (optional for updates)
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Must contain at least one number")
    .matches(/[!@#$%^&*]/)
    .withMessage("Must contain at least one special character"),

  // Mobile number validation
  body("mobileNumber")
    .optional()
    .trim()
    .matches(/^\+?[\d\s-]+$/)
    .withMessage("Invalid phone number format"),

  // Active status validation
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
