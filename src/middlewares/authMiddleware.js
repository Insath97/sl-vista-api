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
