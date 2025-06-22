const express = require("express");
const router = express.Router();
const CustomerAuthController = require("../../controllers/Customer/customer.controller");
const CustomerValidation = require("../../utils/validations/customer.validations");

// Customer Registration
router.post(
  "/register",
  CustomerValidation.createCustomerValidation,
  CustomerAuthController.registerCustomer
);

module.exports = router;