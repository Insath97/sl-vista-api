const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/transportType.validation");
const transportTypeController = require("../../controllers/admin/transporttype.controller");
const middleware = require("../../middlewares/auth.middleware");

router.get("/", validate.list, transportTypeController.getAllTransportTypes);

router.get(
  "/:id",
  validate.getById,
  transportTypeController.getTransportTypeById
);

router.use(middleware.authenticate);

router.post("/", validate.create, transportTypeController.createTransportType);

router.get("/", validate.list, transportTypeController.getAllTransportTypes);

router.get(
  "/:id",
  validate.getById,
  transportTypeController.getTransportTypeById
);

router.put(
  "/:id",
  validate.update,
  transportTypeController.updateTransportType
);

router.delete(
  "/:id",
  validate.delete,
  transportTypeController.deleteTransportType
);

router.patch(
  "/:id/restore",
  validate.restore,
  transportTypeController.restoreTransportType
);

router.patch(
  "/:id/toggle-visibility",
  validate.toggleVisibility,
  transportTypeController.toggleVisibility
);

module.exports = router;
