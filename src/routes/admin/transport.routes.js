// routes/transportRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/transport.controller");
const validate = require("../../utils/validations/transport.validation");
const { uploadTransportImages } = require("../../middlewares/upload");
const authMiddleware = require("../../middlewares/authMiddleware");

// Apply authentication to all routes
router.use(authMiddleware);

router.post(
  "/",
  validate.create,
  uploadTransportImages,
  controller.createTransport
);

router.get("/", validate.list, controller.getAllTransports);

module.exports = router;
