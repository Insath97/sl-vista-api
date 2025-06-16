const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/homestay.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");
const validate = require("../../utils/validations/homestay.validations");

router.use(authMiddleware);

router.post("/", uploadMiddleware, validate.create, controller.createHomeStay);

module.exports = router;
