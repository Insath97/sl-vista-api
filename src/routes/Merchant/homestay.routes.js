const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/homestay.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");
const validate = require("../../utils/validations/homestay.validations");

router.use(authMiddleware);

/* create homestay */
router.post("/", uploadMiddleware, validate.create, controller.createHomeStay);

/* get all homestays */
router.get("/", validate.list, controller.getAllHomeStays);

/* get homestay by ID */
router.get("/:id", validate.getById, controller.getHomeStayById);

module.exports = router;
