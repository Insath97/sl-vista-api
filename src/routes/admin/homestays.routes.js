const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/homestay.controller");
const validate = require("../../utils/validations/homestay.validations");
const middleware = require("../../middlewares/authMiddleware");

router.use(middleware.authMiddlewareWithProfile("admin"));

/* Get All Homestays list fo Admin */
router.get("/", validate.list, controller.getAllHomestaysForAdmin);

module.exports = router;
