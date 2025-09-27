const { body, query } = require("express-validator");

exports.googleAuth = [
  body("token")
    .notEmpty()
    .withMessage("Google token is required")
    .isJWT()
    .withMessage("Invalid token format"),
];

exports.webAuth = [
  query("redirect_url")
    .optional()
    .isURL()
    .withMessage("Invalid redirect URL"),
];

exports.verifyToken = [
  body("token")
    .notEmpty()
    .withMessage("Token is required")
    .isJWT()
    .withMessage("Invalid token format"),
];