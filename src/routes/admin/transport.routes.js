const express = require("express");
const router = express.Router();
const transportController = require("../../controllers/admin/transport.controller");
const validate = require("../../utils/validations/transport.validation");
const authMiddleware = require("../../middlewares/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// CRUD Routes
router.post(
  "/",
  validate.create,
  transportController.uploadImages,
  transportController.createTransport
);

router.get("/", validate.list, transportController.getAllTransports);

router.get("/:id", validate.getById, transportController.getTransportById);

router.put(
  "/:id",
  validate.update,
  transportController.uploadImages,
  transportController.updateTransport
);

router.delete("/:id", validate.delete, transportController.deleteTransport);

router.patch(
  "/:id/restore",
  validate.restore,
  transportController.restoreTransport
);

router.patch(
  "/:id/toggle-verified",
  validate.toggleVerified,
  transportController.toggleVerified
);

module.exports = router;
