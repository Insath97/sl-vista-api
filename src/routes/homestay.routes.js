const express = require("express");
const router = express.Router();
const controller = require("../controllers/homestay.controller");
const validate = require("../utils/validations/homestay.validations");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const middleware = require("../middlewares/auth.middleware");
const { route } = require("./languagesRoutes");

/* public route */
router.get("/public", controller.getAllHomeStays);
router.get("/public/:id", controller.getHomeStayById);

router.use(middleware.authenticate);

/* create */
router.post("/", uploadMiddleware, validate.create, controller.createHomestay);

/* get all */
router.get("/", validate.list, controller.getAllHomeStays);

/* get by id */
router.get("/:id", controller.getHomeStayById);

/* update */
router.put("/:id", uploadMiddleware, controller.updateHomeStay);

/* delete */
router.delete("/:id", controller.deleteHomeStay);

/* restore */
router.patch("/restore/:id", controller.restoreHomeStay);

/* vista verification */
router.patch("/verify/:id", controller.vistaVerification);

/* active status */
router.patch("/status/:id", controller.updateHomeStayStatus);

/* availability status */
router.patch("/availability/:id", controller.updateAvailabilityStatus);

/* approval status */
router.patch("/approval/:id", controller.updateApprovalStatus);

module.exports = router;
