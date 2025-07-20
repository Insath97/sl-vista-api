const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Permission = require("../models/permisson.model");
const Role = require("../models/role.model");

/**
 * Create a new role
 */
exports.createRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, userType, permissionIds } = req.body;
    const requestingUser = req.user;

    // Authorization check
    if (userType === "admin" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only system admins can create system roles",
      });
    }

    if (
      userType === "admin" &&
      !["admin", "system"].includes(requestingUser.accountType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only admins can create admin roles",
      });
    }

    const role = await Role.create({
      name,
      description,
      userType,
      createdBy: requestingUser.id,
      updatedBy: requestingUser.id,
    });

    if (permissionIds?.length) {
      await role.setPermissions(permissionIds, { userId: requestingUser.id });
    }

    const roleWithPermissions = await Role.findByPk(role.id, {
      include: [{ model: Permission, as: "permissions" }],
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: roleWithPermissions,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get all roles with filtering options
 */
exports.getAllRoles = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userType, search, includeDeleted } = req.query;
    const requestingUser = req.user;

    // Build where clause based on user's permissions
    let where = {};

    // System admin can see all roles
    if (requestingUser.accountType === "admin") {
      if (userType) where.userType = userType;
    }
    // Regular admin can see admin and merchant roles
    else if (requestingUser.accountType === "admin") {
      where.userType = { [Op.in]: ["admin", "merchant"] };
      if (userType && userType !== "system") {
        where.userType = userType;
      }
    }
    // Merchant can only see merchant roles
    else if (requestingUser.accountType === "merchant") {
      where.userType = "merchant";
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view roles",
      });
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      include: [{ model: Permission, as: "permissions" }],
      order: [["createdAt", "DESC"]],
      paranoid: includeDeleted !== "true",
    };

    const roles = await Role.findAll(options);

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get role by ID
 */
exports.getRoleById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const requestingUser = req.user;

    const options = {
      where: { id: req.params.id },
      include: [{ model: Permission, as: "permissions" }],
      paranoid: includeDeleted !== "true",
    };

    const role = await Role.findOne(options);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Authorization check
    if (role.userType === "system" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this role",
      });
    }

    if (
      role.userType === "admin" &&
      !["admin", "system"].includes(requestingUser.accountType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this role",
      });
    }

    if (
      role.userType === "merchant" &&
      requestingUser.accountType === "customer"
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this role",
      });
    }

    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update an existing role
 */
exports.updateRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, permissionIds } = req.body;
    const requestingUser = req.user;

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Authorization check
    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: "System roles cannot be modified",
      });
    }

    if (role.userType === "system" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only system admins can modify system roles",
      });
    }

    if (
      role.userType === "admin" &&
      !["admin", "system"].includes(requestingUser.accountType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only admins can modify admin roles",
      });
    }

    // Update role
    await role.update({
      name: name || role.name,
      description: description || role.description,
      updatedBy: requestingUser.id,
    });

    // Update permissions if provided
    if (permissionIds) {
      await role.setPermissions(permissionIds, { userId: requestingUser.id });
    }

    const updatedRole = await Role.findByPk(role.id, {
      include: [{ model: Permission, as: "permissions" }],
    });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete a role (soft delete)
 */
exports.deleteRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const requestingUser = req.user;

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Authorization check
    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: "System roles cannot be deleted",
      });
    }

    if (role.userType === "system" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only system admins can delete system roles",
      });
    }

    if (
      role.userType === "admin" &&
      !["admin", "system"].includes(requestingUser.accountType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete admin roles",
      });
    }

    // Check if role is assigned to any users
    const userCount = await role.countUsers();
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete role that is assigned to users",
      });
    }

    await role.destroy();

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Restore a soft-deleted role
 */
exports.restoreRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const requestingUser = req.user;

    const role = await Role.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found (including soft-deleted)",
      });
    }

    if (!role.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Role is not deleted",
      });
    }

    // Authorization check
    if (role.userType === "system" && requestingUser.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only system admins can restore system roles",
      });
    }

    if (
      role.userType === "admin" &&
      !["admin", "system"].includes(requestingUser.accountType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only admins can restore admin roles",
      });
    }

    await role.restore();

    const updatedRole = await Role.findByPk(req.params.id, {
      include: [{ model: Permission, as: "permissions" }],
    });

    return res.status(200).json({
      success: true,
      message: "Role restored successfully",
      data: updatedRole,
    });
  } catch (error) {
    console.error("Error restoring role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
