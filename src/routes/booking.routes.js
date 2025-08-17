const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/booking.controller");
const validate = require("../utils/validations/booking.validations");

router.use(middleware.authenticate);

/* create booking */
router.post("/", validate.create, controller.createBooking);

module.exports = router;
