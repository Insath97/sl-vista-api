const { body, query, param } = require("express-validator");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");
const Role = require("../../models/role.model");

exports.createMerchantValidation = [
  // Merchant Name
  body("merchantName")
    .trim()
    .notEmpty()
    .withMessage("Merchant name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Merchant name must be 2-100 characters"),

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
    .isIn(["hotel_and_appartment", "homestay", "both", "other"])
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

  // Business Description
  body("businessDescription")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description too long"),
];

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
      "merchantName",
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
    .isIn(["hotel_and_appartment", "homestay", "both", "other"]),
  query("isSriLankan").optional().isBoolean(),
  query("country").optional().trim().isLength({ max: 50 }),
  query("city").optional().trim().isLength({ max: 50 }),
  query("search").optional().trim().isLength({ max: 100 }),
];

exports.approveMerchantValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid merchant ID")
    .custom(async (merchantId) => {
      const merchant = await MerchantProfile.findByPk(merchantId);
      if (!merchant) {
        throw new Error("Merchant not found");
      }
      return true;
    }),

  body("allowedPropertyTypes")
    .optional()
    .isArray()
    .withMessage("Allowed property types must be an array")
    .custom((types) => {
      const validTypes = ["hotel", "appartment", "homestay", "other"];
      if (types.some((type) => !validTypes.includes(type))) {
        throw new Error(
          `Invalid property type. Valid types are: ${validTypes.join(", ")}`
        );
      }
      return true;
    }),

  body("maxPropertiesAllowed")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Max properties allowed must be between 1 and 100"),

  body("adminNotes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Admin notes too long"),

  body("roleId")
    .notEmpty()
    .withMessage("Role ID is required")
    .isInt()
    .withMessage("Role ID must be an integer")
    .custom(async (roleId) => {
      const role = await Role.findOne({
        where: {
          id: roleId,
          userType: "merchant",
        },
      });
      if (!role) {
        throw new Error("Invalid merchant role ID");
      }
      return true;
    }),
];

exports.rejectMerchantValidation = [
  param("id").isInt().withMessage("Invalid merchant ID"),
  body("rejectionReason")
    .notEmpty()
    .withMessage("Rejection reason is required")
    .isLength({ max: 1000 })
    .withMessage("Rejection reason too long"),
];

exports.updateMerchantStatusValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid merchant ID")
    .custom(async (id) => {
      const merchant = await MerchantProfile.findByPk(id);
      if (!merchant) {
        throw new Error("Merchant not found");
      }
      return true;
    }),

  body("status")
    .isIn(["active", "inactive", "suspended", "pending"])
    .withMessage(
      "Invalid status. Valid values: active, inactive, suspended, pending"
    )
    .custom(async (status, { req }) => {
      const merchant = await MerchantProfile.findByPk(req.params.id);
      if (!merchant) return true; // Let the param validation handle this

      if (merchant.status === status) {
        throw new Error(`Merchant is already ${status}`);
      }

      // Additional business rule checks
      if (status === "active" && merchant.status === "pending") {
        throw new Error(
          "Use the approve endpoint to activate pending merchants"
        );
      }

      return true;
    }),

  body("suspensionReason")
    .if(body("status").equals("suspended"))
    .notEmpty()
    .withMessage("Suspension reason is required when status is suspended")
    .isLength({ max: 1000 })
    .withMessage("Suspension reason too long"),

  body("adminNotes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Admin notes too long"),
];

exports.updateMerchantValidation = [
  param("id").isInt().withMessage("Invalid merchant ID"),
  body("merchantName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Merchant name must be 2-100 characters"),
  body("businessName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be 2-100 characters"),
  body("businessType")
    .optional()
    .isIn(["hotel_and_appartment", "homestay", "both", "other"])
    .withMessage("Invalid business type"),
  body("allowedPropertyTypes")
    .optional()
    .isArray()
    .withMessage("Allowed property types must be an array"),
  body("maxPropertiesAllowed")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Max properties allowed must be between 1 and 100"),
  body("adminNotes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Admin notes too long"),
];

exports.deleteMerchantValidation = [
  param("id").isInt().withMessage("Invalid merchant ID"),
];

exports.restoreMerchantValidation = [
  param("id").isInt().withMessage("Invalid merchant ID"),
];
