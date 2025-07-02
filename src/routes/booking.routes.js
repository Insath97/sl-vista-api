const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/authMiddleware");
const controller = require("../controllers/booking.controller");
const validate = require("../utils/validations/booking.validations");


/* Create booking */
router.post("/",middleware.authMiddleware, validate.createBookingValidation, controller.createBooking);

/* Get all bookings */
router.get(
  "/",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  validate.listBookingsValidation,
  controller.getAllBookings
);

module.exports = router;
