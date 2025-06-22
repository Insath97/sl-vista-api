const express = require("express");
const router = express.Router();
const CustomerAuthController = require("../../controllers/Customer/customer.controller");
const CustomerValidation = require("../../utils/validations/customer.validations");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

router.get(
  "/",
  CustomerValidation.listCustomersValidation,
  CustomerAuthController.listCustomers
);

module.exports = router;
