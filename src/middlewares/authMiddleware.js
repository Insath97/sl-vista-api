const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");
const cookies = require("../utils/cookies");
require("dotenv").config();

/* Authentication middleware */
exports.authMiddleware = async (req, res, next) => {
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
      console.error("Token verification error:", verifyError);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        error:
          process.env.NODE_ENV === "development"
            ? verifyError.message
            : undefined,
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/* Middleware to check user roles */
exports.authMiddlewareWithProfile = (requiredRoles = []) => {
  // Convert single role to array if needed
  if (typeof requiredRoles === "string") requiredRoles = [requiredRoles];

  return async (req, res, next) => {
    try {
      // Token extraction
      const token =
        req.cookies.accessToken ||
        (req.headers.authorization?.startsWith("Bearer ") &&
          req.headers.authorization.split(" ")[1]);

      if (!token)
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });

      // Token verification
      const decoded = verifyToken(token);
      if (!decoded)
        return res.status(401).json({
          success: false,
          message: "User belonging to this token no longer exists.",
        });

      // Determine which profile to include based on required roles
      const include = [];
      if (requiredRoles.includes("admin"))
        include.push({
          model: AdminProfile,
          as: "adminProfile",
        });
      if (requiredRoles.includes("merchant"))
        include.push({
          model: MerchantProfile,
          as: "merchantProfile",
        });

      // User lookup
      const user = await User.findByPk(decoded.id, { include });
      if (!user)
        return res.status(401).json({
          success: false,
          message: "User not found",
        });

      // Role verification
      if (requiredRoles.length && !requiredRoles.includes(user.accountType)) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      res.status(500).json({
        success: false,
        message: "Authentication failed",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
};
