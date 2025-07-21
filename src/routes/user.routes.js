const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/authMiddleware");
const controller = require("../controllers/user.controller");
const validate = require("../utils/validations/user.validation");

router.use(middleware.authMiddlewareWithProfile(['admin']));

module.exports = router