const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");
require("dotenv").config();

// Middleware to protect routes
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    let token =
      req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Check if user still exists
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User belonging to this token no longer exists.",
      });
    }

    // Attach user to request
    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;
