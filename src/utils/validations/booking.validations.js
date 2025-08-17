const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Booking = require("../../models/booking.model");
const Room = require("../../models/room.model");
const HomeStay = require("../../models/homeStay.model");
const CustomerProfile = require("../../models/customerProfile.model");

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

// Booking creation validations
const createBookingValidations = [
  body("checkInDate")
    .notEmpty()
    .withMessage("Check-in date is required")
    .isDate()
    .withMessage("Invalid check-in date format")
    .custom((value, { req }) => {
      if (new Date(value) < new Date()) {
        throw new Error("Cannot book for past dates");
      }
      return true;
    }),

  body("checkOutDate")
    .notEmpty()
    .withMessage("Check-out date is required")
    .isDate()
    .withMessage("Invalid check-out date format")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.checkInDate)) {
        throw new Error("Check-out date must be after check-in date");
      }
      return true;
    }),

  body("rooms")
    .optional()
    .isArray()
    .withMessage("Rooms must be an array")
    .custom(async (value, { req }) => {
      if (value.length > 0) {
        const roomIds = value.map((room) => room.id);
        const rooms = await Room.findAll({
          where: { id: roomIds },
          attributes: ["id", "availabilityStatus"],
        });

        if (rooms.length !== roomIds.length) {
          throw new Error("One or more rooms not found");
        }

        const unavailableRooms = rooms.filter(
          (room) => room.availabilityStatus !== "available"
        );

        if (unavailableRooms.length > 0) {
          throw new Error(
            `Rooms with IDs ${unavailableRooms
              .map((r) => r.id)
              .join(", ")} are not available`
          );
        }
      }
      return true;
    }),

  body("rooms.*.id")
    .if(body("rooms").exists())
    .isInt({ min: 1 })
    .withMessage("Invalid room ID format"),

  body("rooms.*.specialRequests")
    .optional()
    .isString()
    .withMessage("Special requests must be a string")
    .isLength({ max: 500 })
    .withMessage("Special requests must be less than 500 characters"),

  body("homestays")
    .optional()
    .isArray()
    .withMessage("Homestays must be an array")
    .custom(async (value, { req }) => {
      if (value.length > 0) {
        const homestayIds = value.map((homestay) => homestay.id);
        const homestays = await HomeStay.findAll({
          where: { id: homestayIds },
          attributes: ["id", "availabilityStatus"],
        });

        if (homestays.length !== homestayIds.length) {
          throw new Error("One or more homestays not found");
        }

        const unavailableHomestays = homestays.filter(
          (homestay) => homestay.availabilityStatus !== "available"
        );

        if (unavailableHomestays.length > 0) {
          throw new Error(
            `Homestays with IDs ${unavailableHomestays
              .map((h) => h.id)
              .join(", ")} are not available`
          );
        }
      }
      return true;
    }),

  body("homestays.*.id")
    .if(body("homestays").exists())
    .isInt({ min: 1 })
    .withMessage("Invalid homestay ID format"),

  body("homestays.*.specialRequests")
    .optional()
    .isString()
    .withMessage("Special requests must be a string")
    .isLength({ max: 500 })
    .withMessage("Special requests must be less than 500 characters"),

  body("specialRequests")
    .optional()
    .isString()
    .withMessage("Special requests must be a string")
    .isLength({ max: 1000 })
    .withMessage("Special requests must be less than 1000 characters"),

  body("paymentMethod")
    .isIn(["credit_card", "debit_card", "bank_transfer", "cash", "wallet"])
    .withMessage("Invalid payment method"),

  body("numberOfGuests")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Number of guests must be at least 1")
    .default(1),

  body("numberOfChildren")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Number of children cannot be negative")
    .default(0),

  body("numberOfInfants")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Number of infants cannot be negative")
    .default(0),
];

// Booking query validations
const queryValidations = [
  query("status")
    .optional()
    .isIn(["pending", "confirmed", "cancelled", "completed", "failed"])
    .withMessage("Invalid booking status"),

  query("fromDate").optional().isDate().withMessage("Invalid from date format"),

  query("toDate")
    .optional()
    .isDate()
    .withMessage("Invalid to date format")
    .custom((value, { req }) => {
      if (
        req.query.fromDate &&
        new Date(value) < new Date(req.query.fromDate)
      ) {
        throw new Error("To date must be after from date");
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

  query("includeCancelled")
    .optional()
    .isBoolean()
    .withMessage("includeCancelled must be a boolean")
    .toBoolean()
    .default(false),
];

// Booking cancellation validations
const cancelValidations = [
  body("cancellationReason")
    .optional()
    .isString()
    .withMessage("Cancellation reason must be a string")
    .isLength({ max: 1000 })
    .withMessage("Cancellation reason must be less than 1000 characters"),
];

// Booking status update validations
const statusUpdateValidations = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["confirmed", "completed", "cancelled"])
    .withMessage("Invalid status"),
];

module.exports = {
  create: createBookingValidations,
  list: queryValidations,
  getById: [validateIdParam("id", Booking)],
  cancel: cancelValidations,
  updateStatus: statusUpdateValidations,
};
