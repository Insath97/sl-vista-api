const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Permission = require("../models/permisson.model");
const Role = require("../models/role.model");

// Create role with permissions
exports.createRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, userType, permissionIds } = req.body;
    const requestingUser = req.user;

    // Validate user can create this type of role
    if (userType === "admin" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create admin roles",
      });
    }

    const role = await Role.create({ name, userType });

    if (permissionIds && permissionIds.length) {
      // Verify permissions exist and match userType
      const permissions = await Permission.findAll({
        where: {
          id: permissionIds,
          userType,
        },
      });

      if (permissions.length !== permissionIds.length) {
        return res.status(400).json({
          success: false,
          message:
            "Some permissions are invalid or not allowed for this user type",
        });
      }

      await role.addPermissions(permissions);
    }

    const roleWithPermissions = await Role.findByPk(role.id, {
      include: {
        model: Permission,
        as: "permissions",
      },
    });

    res.status(201).json({
      success: true,
      data: roleWithPermissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message,
    });
  }
};
