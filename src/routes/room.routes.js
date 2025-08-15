const express = require("express");
const router = express.Router();
const controller = require("../controllers/room.controller");
const validate = require("../utils/validations/room.validation");
const middleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

router.get("/public", validate.list, controller.getAllRooms);
router.get("/public/:id", controller.getRoomById);

router.use(middleware.authenticate);

/* create */
router.post("/", uploadMiddleware, validate.create, controller.createRoom);

/* get all */
router.get("/", validate.list, controller.getAllRooms);

/* get by id */
router.get("/:id", validate.getById, controller.getRoomById);

/* update */
router.put("/:id", uploadMiddleware, validate.update, controller.updateRoom);

/* delete */
router.delete("/:id", validate.delete, controller.deleteRoom);

/* restore */
router.patch("/restore/:id", validate.restore, controller.restoreRoom);

/* vista verfication */
router.patch("/verify/:id", validate.verify, controller.vistaVerification);

/* status update */
router.patch("/status/:id", validate.updateStatus, controller.updateRoomStatus);

/* Availability status update */
router.patch(
  "/availability/:id",
  validate.updateAvailability,
  controller.updateAvailabilityStatus
);

/* approval status */
router.patch(
  "/approval/:id",
  validate.updateApproval,
  controller.updateApprovalStatus
);

module.exports = router;
