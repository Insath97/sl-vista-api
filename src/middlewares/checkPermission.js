const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");

module.exports = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Get user from request (attached by auth middleware)
      const user = req.user;

      // Super admin bypass
      if (user.accountType === "admin" && user.isSuperAdmin) {
        return next();
      }

      // Get user's roles with permissions
      const roles = await user.getRoles({
        include: {
          model: Permission,
          as: "permissions",
          where: { name: requiredPermission },
        },
      });

      // Check if any role has the required permission
      const hasPermission = roles.some(
        (role) => role.permissions && role.permissions.length > 0
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Forbidden - Insufficient permissions",
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: error.message,
      });
    }
  };
};
