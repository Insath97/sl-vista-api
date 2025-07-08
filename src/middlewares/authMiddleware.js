const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");
const CustomerProfile = require("../models/customerProfile.model")
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
      const currentUser = await User.findByPk(decoded.id, {
        include: [
          {
            model: CustomerProfile,
            as: "customerProfile",
            required: false,
          },
        ],
      });
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
      // Token extraction (same as before)
      const token =
        req.cookies.accessToken ||
        (req.headers.authorization?.startsWith("Bearer ") &&
          req.headers.authorization.split(" ")[1]);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }

      // Token verification (same as before)
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: "User belonging to this token no longer exists.",
        });
      }

      // Fixed include options - use explicit model references
      const include = [];

      if (requiredRoles.includes("admin")) {
        include.push({
          model: AdminProfile,
          as: "adminProfile",
          required: false,
        });
      }

      if (requiredRoles.includes("merchant")) {
        include.push({
          model: MerchantProfile,
          as: "merchantProfile",
          required: false,
        });
      }

      if (requiredRoles.includes("customer")) {
        include.push({
          model: CustomerProfile,
          as: "customerProfile",
          required: false,
        });
      }

      // User lookup
      const user = await User.findByPk(decoded.id, {
        include,
        attributes: {
          exclude: ["password"], // Always exclude sensitive data
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      /*   // Role verification - check if user has at least one of the required roles
      const normalizedAccountType = user.accountType.toLowerCase();
      const normalizedRequiredRoles = requiredRoles.map((role) =>
        role.toLowerCase()
      );

      if (
        requiredRoles.length > 0 &&
        !normalizedRequiredRoles.includes(normalizedAccountType)
      ) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required roles: ${requiredRoles.join(
            ", "
          )}`,
        });
      } */

      // Attach user and profiles to request
      req.user = user;
      req.isAdmin = user.accountType === "admin";
      req.isMerchant = user.accountType === "merchant";
      req.isCustomer = user.accountType === "customer";

      // Attach specific profiles if they exist
      if (user.adminProfile) req.adminProfile = user.adminProfile;
      if (user.merchantProfile) req.merchantProfile = user.merchantProfile;
      if (user.customerProfile) req.customerProfile = user.customerProfile;

      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication failed",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
};
