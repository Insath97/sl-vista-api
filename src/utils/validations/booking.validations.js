// validations/booking.validation.js
const { body, param, query } = require("express-validator");
const { isAfter, isBefore, addDays } = require("date-fns");

exports.createBookingValidation = [
  body("homestayId")
    .isInt()
    .withMessage("Invalid homestay ID"),
  
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
    })
];

exports.cancelBookingValidation = [
  param("id")
    .isInt()
    .withMessage("Invalid booking ID")
];