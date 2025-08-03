const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/activities.controller");
const validate = require("../../utils/validations/activities.validation");
const authMiddleware = require("../../middlewares/auth.middleware");
const uploadMiddleware = require("../../middlewares/uploadMiddleware");

router.use(authMiddleware.authMiddlewareWithProfile(["admin"]));

//Create activities
router.post(
  "/",
  uploadMiddleware,
  // validate.create,
  controller.createActivity
);

//Get activites
router.get("/", validate.list, controller.getAllActivities);

//Get by Id
router.get("/:id", validate.getById, controller.getActivityById);

//Update by Id
router.put(
  "/:id",
  //uploadMiddleware,
  validate.update,
  controller.updateActivity
);

//Delete by Id
router.delete("/:id", validate.delete, controller.deleteActivity);

//Restore
router.patch("/restore/:id", controller.restoreActivity);

//Toggle active status
router.patch(
  "/status/:id",
  validate.toggleStatus,
  controller.toggleActiveStatus
);

//Verify
router.patch(
  "/verify/:id",
  //validate.verify,
  controller.verifyActivity
);

//Update image
router.put(
  "/images/:id",
  //validate.updateImages,
  controller.updateImages
);

//Delete image
router.delete(
  "/:id/images/:imageId",
  //validate.deleteImage,
  controller.deleteImage
);

//Set featured image
router.patch(
  "/:id/images/:imageId/featured",
  //validate.setFeaturedImage,
  controller.setFeaturedImage
);

module.exports = router;
