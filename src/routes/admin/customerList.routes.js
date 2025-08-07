const express = require("express");
const router = express.Router();
const CustomerAuthController = require("../../controllers/Customer/customer.controller");
const CustomerValidation = require("../../utils/validations/customer.validations");
const middleware = require("../../middlewares/auth.middleware");

router.use(middleware.authenticate);

router.get(
  "/",
  CustomerValidation.listCustomersValidation,
  CustomerAuthController.listCustomers
);

module.exports = router;
