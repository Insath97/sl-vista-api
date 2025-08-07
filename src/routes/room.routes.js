const express = require("express");
const router = express.Router();
const controller = require("../controllers/room.controller");
const validate = require("../utils/validations/room.validation");
const middleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/uploadMiddleware");

router.use(middleware.authenticate);

/* create */
router.post(
  "/",
  upload,
  validate.create,
  controller.createRoom
);

/* get all */
router.get(
  "/",
  validate.list,
  controller.getAllRooms
);

/* get by id */
router.get(
  "/:id",
  validate.getById,
  controller.getRoomById
);

module.exports = router;
