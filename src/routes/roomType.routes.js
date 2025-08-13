const express = require("express");
const router = express.Router();
const controller = require("../controllers/roomType.controller");
const validate = require("../utils/validations/roomType.validation");
const middleware = require("../middlewares/auth.middleware");

// Authenticated routes
router.use(middleware.authenticate);

// Create
router.post("/", validate.create, controller.createRoomType);

// get all
router.get("/", validate.list, controller.getAllRoomTypes);

// get by id
router.get("/:id", validate.getById, controller.getRoomTypeById);

// Update
router.put("/:id", validate.update, controller.updateRoomType);

// Delete
router.delete("/:id", validate.delete, controller.deleteRoomType);

// Restore
router.patch("/restore/:id", validate.restore, controller.restoreRoomType);

// Status management
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleRoomTypeStatus
);

module.exports = router;
