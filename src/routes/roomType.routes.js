const express = require("express");
const router = express.Router();
const controller = require("../controllers/Merchant/roomType.controller");
const validate = require("../utils/validations/roomType.validation");
const middleware = require("../middlewares/auth.middleware");

router.use(middleware.authMiddlewareWithProfile(["admin", "merchant"]));

/* create roomtype */
router.post("/", validate.create, controller.createRoomType);

/* get all roomtype */
router.get("/", validate.list, controller.getAllRoomTypes);

/* get by ID */
router.get("/:id", validate.getById, controller.getRoomTypeById);

/* update room type */
router.put("/:id", validate.update, controller.updateRoomType);

/* DELETE */
router.delete("/:id", validate.delete, controller.deleteRoomType);

/* restore */
router.patch("/:id/restore", validate.restore, controller.restoreRoomType);

module.exports = router;
