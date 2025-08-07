const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");
const CustomerProfile = require("../models/customerProfile.model");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const cookies = require("../utils/cookies");
require("dotenv").config();

/* Authentication middleware */
exports.authenticate = async (req, res, next) => {
  try {
    // 1. Get token from cookies or Authorization header
    let token = req.cookies.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Access denied. No token provided.",
      });
    }

    // 2. Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      });
    }

    // 3. Get basic user info without profile first
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User account not found or inactive",
      });
    }

    // 4. Attach basic user info to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({
      success: false,
      code: "AUTH_FAILED",
      message: "Authentication failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Authorization middleware */
exports.authorize = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      // Skip if no permissions required
      if (requiredPermissions.length === 0) return next();

      // Get user with roles and permissions
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: "roles",
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: "permissions",
                through: { attributes: [] },
                attributes: ["name"],
              },
            ],
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "User not found",
        });
      }

      // Collect all unique permissions
      const userPermissions = new Set();
      user.roles.forEach((role) => {
        role.permissions.forEach((permission) => {
          userPermissions.add(permission.name);
        });
      });

      // Check permissions
      const missingPermissions = requiredPermissions.filter(
        (perm) => !userPermissions.has(perm)
      );

      if (missingPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Insufficient permissions",
        });
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({
        success: false,
        code: "AUTHZ_FAILED",
        message: "Authorization check failed",
      });
    }
  };
};

