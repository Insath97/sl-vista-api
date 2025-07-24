const express = require("express");
const router = express.Router();
const controller = require("../controllers/room.controller");
const validate = require("../utils/validations/room.validation");
const middleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/uploadMiddleware");

/* create */
router.post(
  "/",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  upload,
  validate.create,
  controller.createRoom
);

/* get all */
router.get(
  "/",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  validate.list,
  controller.getAllRooms
);

/* get by id */
router.get(
  "/:id",
  middleware.authMiddlewareWithProfile(["admin", "merchant"]),
  validate.getById,
  controller.getRoomById
);

module.exports = router;
