const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Permission = require("../models/permisson.model");

/**
 * Get all permissions
 */
exports.getAllPermissions = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { category, userType, search, includeDeleted } = req.query;

    const where = {};
    if (category) where.category = category;
    if (userType) where.userType = userType;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      order: [
        ["category", "ASC"],
        ["name", "ASC"],
      ],
      paranoid: includeDeleted !== "true",
    };

    const permissions = await Permission.findAll(options);

    return res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get permission by ID
 */
exports.getPermissionById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const options = {
      where: { id: req.params.id },
      paranoid: includeDeleted !== "true",
    };

    const permission = await Permission.findOne(options);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error("Error fetching permission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create permission
 */
exports.createPermission = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { category, name, userType } = req.body;

    const permission = await Permission.create({
      category,
      name,
      userType,
    });

    return res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update permission
 */
exports.updatePermission = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const permission = await Permission.findByPk(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    const { category, name, userType } = req.body;

    await permission.update({
      category,
      name,
      userType,
    });

    return res.status(200).json({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete permission
 */
exports.deletePermission = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const permission = await Permission.findByPk(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    await permission.destroy();

    return res.status(200).json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Restore soft-deleted permission
 */
exports.restorePermission = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const permission = await Permission.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found (including soft-deleted)",
      });
    }

    if (!permission.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Permission is not deleted",
      });
    }

    await permission.restore();

    return res.status(200).json({
      success: true,
      message: "Permission restored successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Error restoring permission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
