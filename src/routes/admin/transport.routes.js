const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/transport.controller");
const validate = require("../../utils/validations/transport.validation");
const authMiddleware = require("../../middlewares/authMiddleware");


router.use(authMiddleware);

router.post("/", validate.create, controller.createTransport);

router.get("/", validate.list, controller.getAllTransports);

router.get("/:id", validate.getById, controller.getTransportById);

router.put("/:id", validate.update, controller.updateTransport);

router.delete("/:id", validate.delete, controller.deleteTransport);

router.patch("/restore/:id", controller.restoreTransport);

router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

/* vista verify */
router.patch("/:id/verify", validate.getById, controller.verifyTransport);

module.exports = router;
