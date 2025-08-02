const express = require("express");
const router = express.Router();
const controller = require("../controllers/property.controller");
const validate = require("../utils/validations/property.validation");
const middleware = require("../middlewares/auth.middleware");

router.use(middleware.authenticate);

// Create Property
router.post("/", controller.createProperty);

module.exports = router;
