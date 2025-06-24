const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/homestay.controller");
const validate = require("../../utils/validations/homestay.validations");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

/* Get All Homestays list fo Admin */
router.get("/", validate.list, controller.getAllHomestaysForAdmin);

module.exports = router;
