const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");
const UserRole = require("../models/userRole.model");
const Permission = require("../models/permisson.model");

/**
 * Create admin users with their single role and permissions
 */
exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const transaction = await sequelize.transaction(); // Start a transaction
  try {
    const { email, password, roleId, ...profileData } = req.body;

    // Check if email exists in User table
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create the user
    const user = await User.create(
      {
        email,
        password,
        accountType: "admin",
      },
      { transaction }
    );

    // Create admin profile
    await AdminProfile.create(
      {
        userId: user.id,
        ...profileData,
      },
      { transaction }
    );

    // Assign role if provided
    if (roleId) {
      // Verify role exists and is an admin role
      const role = await Role.findOne({
        where: {
          id: roleId,
          userType: "admin",
        },
        transaction,
      });

      if (!role) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Role is invalid or not an admin role",
        });
      }

      // Assign single role to user
      await UserRole.create(
        {
          userId: user.id,
          roleId: role.id,
        },
        { transaction }
      );
    }

    // Commit the transaction
    await transaction.commit();

    // Fetch the complete user data with role
    const newUser = await User.findByPk(user.id, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] }, // Exclude junction table attributes
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    return res.status(201).json({
      success: true,
      message: "New User created successfully",
      data: newUser,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get all admin users with their single role and permissions
 */
exports.getAllAdminUsers = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { search, includeInactive, includeDeleted } = req.query;

    const where = {
      accountType: "admin",
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { "$adminProfile.fullName$": { [Op.like]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
          attributes: { exclude: ["createdBy", "updatedBy"] },
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
      paranoid: includeDeleted !== "true",
    };

    const users = await User.findAll(options);

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get admin user by ID with role and permissions
 */
exports.getAdminUserById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;

    const options = {
      where: { id: req.params.id, accountType: "admin" },
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
          attributes: { exclude: ["createdBy", "updatedBy"] },
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
      paranoid: includeDeleted !== "true",
    };

    const user = await User.findOne(options);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update admin user including role assignment
 */
exports.updateAdminUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const transaction = await sequelize.transaction();
  try {
    const { email, password, roleId, ...profileData } = req.body;
    const userId = req.params.id;

    // Find existing user
    const user = await User.findOne({
      where: { id: userId, accountType: "admin" },
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Update user
    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    await user.update(updateData, { transaction });

    // Update profile
    const profile = await AdminProfile.findOne({
      where: { userId },
      transaction,
    });
    if (profile) {
      await profile.update(profileData, { transaction });
    }

    // Handle role assignment
    if (roleId !== undefined) {
      // Remove all existing roles
      await UserRole.destroy({
        where: { userId },
        transaction,
      });

      // Add new role if provided
      if (roleId) {
        const role = await Role.findOne({
          where: { id: roleId, userType: "admin" },
          transaction,
        });

        if (!role) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "Role is invalid or not an admin role",
          });
        }

        await UserRole.create(
          {
            userId,
            roleId,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    // Fetch updated user with associations
    const updatedUser = await User.findByPk(userId, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Admin user updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete admin user (soft delete)
 */
exports.deleteAdminUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.params.id;

    const user = await User.findOne({
      where: { id: userId, accountType: "admin" },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    await user.destroy();

    return res.status(200).json({
      success: true,
      message: "Admin user deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Restore soft-deleted admin user
 */
exports.restoreAdminUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.params.id;

    const user = await User.findOne({
      where: { id: userId, accountType: "admin" },
      paranoid: false,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found (including soft-deleted)",
      });
    }

    if (!user.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Admin user is not deleted",
      });
    }

    // Check if email is still available
    const existingUser = await User.findOne({
      where: {
        email: user.email,
        id: { [Op.ne]: user.id },
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Cannot restore admin user - email already in use",
      });
    }

    await user.restore();

    // Also restore the admin profile if it was deleted
    const profile = await AdminProfile.findOne({
      where: { userId: user.id },
      paranoid: false,
    });
    if (profile && profile.deletedAt) {
      await profile.restore();
    }

    const restoredUser = await User.findByPk(userId, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Admin user restored successfully",
      data: restoredUser,
    });
  } catch (error) {
    console.error("Error restoring admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};