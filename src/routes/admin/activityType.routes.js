const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/activityType.validation");
const controller = require("../../controllers/admin/activityType.controller");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

/* create */
router.post("/", validate.create, controller.createActivityType);

/* get all */
router.get("/", validate.list, controller.getAllActivityTypes);

/* get by id */
router.get("/:id", validate.getById, controller.getActivityTypeById);

/* update */
router.put("/:id", validate.update, controller.updateActivityType);

/* delete */
router.delete("/:id", validate.delete, controller.deleteActivityType);

/* restore */
router.patch("/:id/restore", validate.restore, controller.restoreActivityType);

/* toggle status */
router.patch(
  "/:id/status",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

module.exports = router;
