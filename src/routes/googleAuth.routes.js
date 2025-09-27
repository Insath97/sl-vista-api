const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth/googleAuth.controller");
const validate = require("../utils/validations/googleAuth.validations");


// Web Google Auth Flow
router.get("/web", controller.initiateWebGoogleAuth);

router.get("/callback", controller.handleWebGoogleCallback); 



module.exports = router;