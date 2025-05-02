const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");
const User = require("../models/user.model");
const cookies = require("../utils/cookies");
require("dotenv").config();

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    let token = req.cookies.accessToken;
    
    // If no cookie token, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    try {
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
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        error: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

module.exports = authMiddleware;