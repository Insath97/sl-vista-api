const { validationResult } = require("express-validator");
const { sequelize } = require("../../config/database");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Register new merchant (initial registration with pending status)
exports.registerMerchant = async (req, res, next) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      businessName,
      businessRegistrationNumber,
      businessType,
      email,
      password,
      isSriLankan,
      nicNumber,
      passportNumber,
      address,
      city,
      country = "Sri Lanka",
      phoneNumber,
    } = req.body;

    // Create transaction for atomic operations
    const result = await sequelize.transaction(async (t) => {
      // Create user first
      const user = await User.create(
        {
          email,
          password,
          accountType: "merchant",
          isActive: true, // Account is active but merchant status is pending
        },
        { transaction: t }
      );

      // Then create merchant profile with pending status
      const merchantProfile = await MerchantProfile.create(
        {
          userId: user.id,
          businessName,
          businessRegistrationNumber,
          businessType,
          isSriLankan,
          nicNumber: isSriLankan ? nicNumber : null,
          passportNumber: !isSriLankan ? passportNumber : null,
          address,
          city,
          country,
          phoneNumber,
          status: "pending", // Initial status
          maxPropertiesAllowed: 1, // Can post only 1 property initially
        },
        { transaction: t }
      );

      return { user, merchantProfile };
    });

    // Prepare response data
    const userData = result.user.toJSON();
    const merchantData = result.merchantProfile.toJSON();

    res.status(201).json({
      success: true,
      message: "Merchant registration submitted for approval",
      data: {
        ...userData,
        merchantProfile: merchantData,
      },
    });
  } catch (err) {
    console.error("Merchant registration error:", err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: err.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
