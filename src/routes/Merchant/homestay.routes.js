const express = require("express");
const router = express.Router();
const controller = require("../../controllers/Merchant/homestay.controller");
const middleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");
const validate = require("../../utils/validations/homestay.validations");

router.use(middleware.authenticate);

/* create homestay */
router.post("/", uploadMiddleware, validate.create, controller.createHomeStay);

/* get all homestays */
router.get("/", validate.list, controller.getAllHomeStays);

/* get homestay by ID */
router.get("/:id", validate.getById, controller.getHomeStayById);

module.exports = router;
