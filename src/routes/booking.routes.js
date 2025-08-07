const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/booking.controller");
const validate = require("../utils/validations/booking.validations");

router.use(middleware.authenticate);

/* Create booking */
router.post(
  "/",
  validate.createBookingValidation,
  controller.createBooking
);

/* Get all bookings */
router.get(
  "/",
  validate.listBookingsValidation,
  controller.getAllBookings
);

router.get("/list", controller.getCustomerBookings);

module.exports = router;
