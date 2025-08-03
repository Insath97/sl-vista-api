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

module.exports = router;
