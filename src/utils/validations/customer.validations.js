const { body, query } = require("express-validator");
const User = require("../../models/user.model");
const CustomerProfile = require("../../models/customerProfile.model");

exports.createCustomerValidation = [
  // First Name
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be 2-50 characters"),

  // Last Name
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be 2-50 characters"),

  // Email
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

  // Password
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),

  

  

  // Mobile Number
  body("mobileNumber")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^\+?[\d\s-]{10,15}$/)
    .withMessage("Invalid phone number format")
    .custom(async (value) => {
      const exists = await CustomerProfile.findOne({
        where: { mobileNumber: value },
      });
      if (exists) throw new Error("Mobile number already registered");
    }),

  // Date of Birth (optional)
  body("dateOfBirth")
    .optional()
    .isDate()
    .withMessage("Invalid date format")
    .custom((value) => {
      const dob = new Date(value);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear();
      if (age < 13) throw new Error("Must be at least 13 years old");
      return true;
    }),

  // Profile Image (optional)
  body("profileImage").optional().isURL().withMessage("Invalid URL format"),
];

exports.listCustomersValidation = [
  // Pagination
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),

  // Sorting
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "firstName", "lastName", "isActive"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),

  // Filtering
  query("isActive").optional().isBoolean().toBoolean(),
  query("isSriLankan").optional().isBoolean().toBoolean(),
  query("search").optional().trim().isLength({ max: 100 }),
];

