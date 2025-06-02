const { body, param } = require("express-validator");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

const propertyIdParam = param("propertyId")
  .isInt()
  .withMessage("Invalid property ID")
  .custom(async (value, { req }) => {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }]
    });
    
    if (!user || !user.merchantProfile) {
      throw new Error("Merchant profile not found");
    }

    const property = await Property.findOne({
      where: {
        id: value,
        merchantId: user.merchantProfile.id
      }
    });

    if (!property) {
      throw new Error("Property not found or not owned by merchant");
    }
    return true;
  });

const propertySettingValidations = [
  body("maxUnits")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max units must be at least 1"),

  body("currentUnits")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Current units cannot be negative"),

  body("minStayDuration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum stay must be at least 1 night"),

  body("maxStayDuration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Maximum stay must be at least 1 night")
    .custom((value, { req }) => {
      if (req.body.minStayDuration && value < req.body.minStayDuration) {
        throw new Error("Max stay cannot be less than min stay");
      }
      return true;
    }),

  body("advanceBookingPeriod")
    .optional()
    .isInt({ min: 1, max: 730 })
    .withMessage("Advance booking period must be between 1-730 days"),

  body("cancellationWindow")
    .optional()
    .isInt({ min: 0, max: 720 })
    .withMessage("Cancellation window must be between 0-720 hours"),

  body("dynamicPricingEnabled")
    .optional()
    .isBoolean()
    .withMessage("Dynamic pricing must be true or false"),

  body("seasonalPricingEnabled")
    .optional()
    .isBoolean()
    .withMessage("Seasonal pricing must be true or false"),

  body("newBookingAlert")
    .optional()
    .isBoolean()
    .withMessage("New booking alert must be true or false"),

  body("maintenanceAlerts")
    .optional()
    .isBoolean()
    .withMessage("Maintenance alerts must be true or false"),

  body("checkInBuffer")
    .optional()
    .isInt({ min: 0, max: 1440 })
    .withMessage("Check-in buffer must be between 0-1440 minutes"),

  body("autoApproveBookings")
    .optional()
    .isBoolean()
    .withMessage("Auto approve bookings must be true or false")
];

module.exports = {
  create: [
    propertyIdParam,
    ...propertySettingValidations
  ],
  get: [
    propertyIdParam
  ],
  update: [
    propertyIdParam,
    ...propertySettingValidations.map(v => v.optional())
  ]
};