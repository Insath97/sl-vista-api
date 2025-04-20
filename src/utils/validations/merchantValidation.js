const { body, query, validationResult } = require("express-validator");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

exports.createMerchantValidation = [
  // Business Name
  body("businessName")
    .trim()
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be 2-100 characters"),

  // Business Registration Number
  body("businessRegistrationNumber")
    .trim()
    .notEmpty()
    .withMessage("Business registration number is required")
    .custom(async (value) => {
      const exists = await MerchantProfile.findOne({
        where: { businessRegistrationNumber: value },
      });
      if (exists)
        throw new Error("Business registration number already exists");
    }),

  // Business Type
  body("businessType")
    .isIn([
      "hotel",
      "homestay",
      "tour_operator",
      "transport",
      "activity_provider",
      "restaurant",
      "other",
    ])
    .withMessage("Invalid business type"),

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

  // Sri Lankan Status
  body("isSriLankan").isBoolean().withMessage("isSriLankan must be a boolean"),

  // NIC Validation (conditional)
  body("nicNumber")
    .if(body("isSriLankan").equals(true))
    .notEmpty()
    .withMessage("NIC is required for Sri Lankan citizens")
    .matches(/^([0-9]{9}[vVxX]|[0-9]{12})$/)
    .withMessage("Invalid NIC format. Use 123456789V or 123456789012")
    .custom(async (value) => {
      const exists = await MerchantProfile.findOne({
        where: { nicNumber: value },
      });
      if (exists) throw new Error("NIC already registered");
    }),

  // Passport Validation (conditional)
  body("passportNumber")
    .if(body("isSriLankan").equals(false))
    .notEmpty()
    .withMessage("Passport is required for foreign merchants")
    .custom(async (value) => {
      const exists = await MerchantProfile.findOne({
        where: { passportNumber: value },
      });
      if (exists) throw new Error("Passport already registered");
    }),

  // Address
  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ max: 200 })
    .withMessage("Address too long"),

  // City
  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 50 })
    .withMessage("City name too long"),

  // Phone Number
  body("phoneNumber")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[\d\s-]{10,15}$/)
    .withMessage("Invalid phone number format"),
];

// Validation rules for merchant listing
exports.listMerchantsValidation = [
  // Pagination
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),

  // Sorting
  query("sortBy")
    .optional()
    .isIn([
      "createdAt",
      "updatedAt",
      "businessName",
      "status",
      "businessType",
      "verificationDate",
    ]),
  query("sortOrder").optional().isIn(["asc", "desc"]),

  // Filtering
  query("status")
    .optional()
    .isIn(["pending", "active", "inactive", "suspended", "rejected"]),
  query("businessType")
    .optional()
    .isIn([
      "hotel",
      "homestay",
      "tour_operator",
      "transport",
      "activity_provider",
      "restaurant",
      "other",
    ]),
  query("isSriLankan").optional().isBoolean().toBoolean(),
  query("country").optional().trim().isLength({ max: 50 }),
  query("city").optional().trim().isLength({ max: 50 }),
  query("search").optional().trim().isLength({ max: 100 }),
];
