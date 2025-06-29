const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/authMiddleware");
const homestaycontroller = require("../controllers/Merchant/homestay.controller");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const validate = require("../utils/validations/homestay.validations");

router.get(
  "/",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]), // Accepts both roles
  validate.list,
  homestaycontroller.getAllHomeStays
);

module.exports = router;
