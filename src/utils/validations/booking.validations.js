// validations/booking.validation.js
const { body, param, query } = require("express-validator");
const { isAfter, isBefore, addDays } = require("date-fns");

exports.createBookingValidation = [
  body("homestayId").isInt().withMessage("Invalid homestay ID"),

  body("checkInDate")
    .isDate()
    .withMessage("Invalid check-in date")
    .custom((value, { req }) => {
      if (isBefore(new Date(value), new Date())) {
        throw new Error("Check-in date cannot be in the past");
      }
      return true;
    }),

  body("checkOutDate")
    .isDate()
    .withMessage("Invalid check-out date")
    .custom((value, { req }) => {
      if (isBefore(new Date(value), new Date(req.body.checkInDate))) {
        throw new Error("Check-out date must be after check-in date");
      }
      return true;
    }),
];

exports.cancelBookingValidation = [
  param("id").isInt().withMessage("Invalid booking ID"),
];

exports.listBookingsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("status")
    .optional()
    .isIn(["pending", "confirmed", "cancelled", "completed", "failed"])
    .withMessage("Invalid booking status"),

  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid from date format (use YYYY-MM-DD)"),

  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid to date format (use YYYY-MM-DD)")
    .custom((value, { req }) => {
      if (
        req.query.fromDate &&
        new Date(value) < new Date(req.query.fromDate)
      ) {
        throw new Error("To date must be after from date");
      }
      return true;
    }),
];
