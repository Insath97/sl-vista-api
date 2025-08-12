const express = require("express");
const router = express.Router();
const controller = require("../controllers/homestay.controller");
const validate = require("../utils/validations/homestay.validations");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const middleware = require("../middlewares/auth.middleware");
const { route } = require("./languagesRoutes");

/* public route */
router.get("/public", validate.list, controller.getAllHomeStays);
router.get("/public/:id", validate.publicGetById, controller.getHomeStayById);

router.use(middleware.authenticate);

/* create */
router.post("/", uploadMiddleware, validate.create, controller.createHomestay);

/* get all */
router.get("/", validate.list, controller.getAllHomeStays);

/* get by id */
router.get("/:id", validate.getById, controller.getHomeStayById);

/* update */
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateHomeStay
);

/* delete */
router.delete("/:id", validate.delete, controller.deleteHomeStay);

/* restore */
router.patch("/restore/:id", validate.restore, controller.restoreHomeStay);

/* vista verification */
router.patch("/verify/:id", validate.verify, controller.vistaVerification);

/* active status */
router.patch(
  "/status/:id",
  validate.updateStatus,
  controller.updateHomeStayStatus
);

/* availability status */
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
