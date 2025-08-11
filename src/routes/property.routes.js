const express = require("express");
const router = express.Router();
const controller = require("../controllers/property.controller");
const validate = require("../utils/validations/property.validation");
const middleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

// Get All
router.get("/public", validate.list, controller.getAllProperties);

// Get By Id
router.get("/public/:id", validate.publicGetById, controller.getPropertyById);

router.use(middleware.authenticate);

// Create Property
router.post("/", uploadMiddleware, validate.create, controller.createProperty);

// Get All
router.get("/", validate.list, controller.getAllProperties);

// Get By Id
router.get("/:id", validate.getById, controller.getPropertyById);

// update
router.put(
  "/:id",
  uploadMiddleware,
  validate.update,
  controller.updateProperty
);

// delete
router.delete("/:id", validate.delete, controller.deleteProperty);

// restore
router.patch("/restore/:id", validate.restore, controller.restoreProperty);

// vista verifiication
router.patch("/verify/:id", validate.verify, controller.vistaVerification);

// status update
router.patch(
  "/status/:id",
  validate.updateStatus,
  controller.updatePropertyStatus
);

// availability status update
router.patch(
  "/availability/:id",
  validate.updateAvailability,
  controller.updateAvailabilityStatus
);

// approval status
router.patch(
  "/approval/:id",
  validate.updateApproval,
  controller.updateApprovalStatus
);

module.exports = router;
