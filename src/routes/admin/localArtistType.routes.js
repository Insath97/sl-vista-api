const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/localArtistType.validation");
const controller = require("../../controllers/admin/localArtistType.controller");
const authMiddleware = require("../../middlewares/authMiddleware");

router.use(authMiddleware);

/* create */
router.post("/", validate.create, controller.createLocalArtistType);

/* get all */
router.get("/", validate.list, controller.getAllLocalArtistTypes);

/* get by id  */
router.get("/:id", validate.getById, controller.getLocalArtistTypeById);

/* update */
router.put("/:id", validate.update, controller.updateLocalArtistType);

// Delete
router.delete("/:id", validate.delete, controller.deleteLocalArtistType);

// Restore
router.post(
  "/:id/restore",
  validate.restore,
  controller.restoreLocalArtistType
);

// Toggle status
router.patch(
  "/:id/status",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

module.exports = router;
