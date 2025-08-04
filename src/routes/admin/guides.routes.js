const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/guides.controller");
const validate = require("../../utils/validations/guides.validation");
const middleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(middleware.authenticate);

/* create route */
router.post("/", uploadMiddleware, validate.create, controller.createGuide);

/* get all routes */
router.get("/", validate.list, controller.getAllGuides);

/* get by id */
router.get("/:id", validate.getById, controller.getGuideById);

/* update  */
router.put("/:id", validate.update, uploadMiddleware, controller.updateGuide);

/* delete */
router.delete("/:id", validate.delete, controller.deleteGuide);

/* restore */
router.patch("/restore/:id", controller.restoreGuide);

/* active status */
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

/* vista verified status */
router.patch("/verify/:id", validate.verify, controller.verifyGuide);

module.exports = router;
