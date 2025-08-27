const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/booking.controller");
const validate = require("../utils/validations/booking.validations");

router.use(middleware.authenticate);

/* create booking */
router.post("/", controller.createBooking);

/* get all bookings */
router.get("/", controller.getAllBookings);

/* get booking by id */
router.get("/:id", controller.getBookingById);

/* cancel booking */
router.patch("/:id", controller.cancelBooking);

/* update booking */
router.patch("/status/:id", controller.updateBookingStatus);

module.exports = router;
