const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/activity.controller");
const validate = require("../../utils/validations/activity.validation");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

router.post(
  "/",
  validate.create,
  controller.uploadImages,
  controller.createActivity
);

router.get("/", validate.list, controller.getAllActivities);

router.get("/:id", validate.getById, controller.getActivityById);

router.put(
  "/:id",
  validate.update,
  controller.uploadImages,
  controller.updateActivity
);

router.delete("/:id", validate.delete, controller.deleteActivity);

router.patch("/:id/restore", validate.restore, controller.restoreActivity);

router.patch("/:id/status", validate.toggleStatus, controller.toggleStatus);

module.exports = router;
