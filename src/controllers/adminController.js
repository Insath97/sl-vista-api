const { validationResult } = require("express-validator");
const { sequelize } = require("../config/database");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");

// Create new admin (both user and profile)
exports.createAdmin = async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { fullName, email, password, mobileNumber } = req.body;

    // Check if email exists in User table
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create transaction for atomic operations
    const result = await sequelize.transaction(async (t) => {
      // Create user first
      const user = await User.create(
        {
          email,
          password,
          accountType: "admin",
          isActive: true,
        },
        { transaction: t }
      );

      // Then create admin profile
      const adminProfile = await AdminProfile.create(
        {
          userId: user.id,
          fullName,
          mobileNumber,
        },
        { transaction: t }
      );

      return { user, adminProfile };
    });

    // Prepare response data
    const userData = result.user.toJSON();
    const adminData = result.adminProfile.toJSON();

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        ...userData,
        adminProfile: adminData,
      },
    });
  } catch (err) {
    console.error("Admin creation error:", err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get all admins with their profiles
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await User.findAll({
      where: {
        accountType: "admin",
        deletedAt: null,
      },
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
          where: { deletedAt: null },
          required: true,
        },
      ],
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins,
    });
  } catch (err) {
    console.error("Get all admins error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve admins",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get admin by ID with profile
exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    /* const admin = await User.findOne({
      where: {
        id,
        accountType: "admin",
        deletedAt: null,
      },
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
          where: { deletedAt: null },
          required: true,
        },
      ],
      attributes: { exclude: ["password"] },
    }); */

    const adminuser = await AdminProfile.findOne({
      where: {
        id: id,
        deletedAt: null,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    if (!adminuser) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      data: adminuser,
    });
  } catch (err) {
    console.error("Get admin by ID error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve admin",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Update admin and profile
exports.updateAdmin = async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { fullName, email, mobileNumber, isActive } = req.body;

    // Find admin user with profile
    const admin = await AdminProfile.findOne({
      where: {
        id: id,
        deletedAt: null,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if email is being changed and already exists
    if (email && email !== admin.email) {
      const emailExists = await User.findOne({
        where: { email, deletedAt: null },
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email already in use by another user",
        });
      }
    }

    // Update in transaction
    await sequelize.transaction(async (t) => {
      // Update user fields
      const userUpdates = {};
      if (email) userUpdates.email = email;
      if (isActive !== undefined) userUpdates.isActive = isActive;

      if (Object.keys(userUpdates).length > 0) {
        await admin.update(userUpdates, { transaction: t });
      }

      // Update profile fields
      const profileUpdates = {};
      if (fullName) profileUpdates.fullName = fullName;
      if (mobileNumber) profileUpdates.mobileNumber = mobileNumber;

      if (Object.keys(profileUpdates).length > 0) {
        await admin.adminProfile.update(profileUpdates, { transaction: t });
      }
    });

    // Get updated admin data
    const updatedAdmin = await User.findByPk(id, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
      ],
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: updatedAdmin,
    });
  } catch (err) {
    console.error("Update admin error:", err);
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update admin",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Soft delete admin (both user and profile)
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Find admin user with profile
    const admin = await AdminProfile.findOne({
      where: {
        id: id,
        deletedAt: null,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Soft delete in transaction
    await sequelize.transaction(async (t) => {
      await admin.destroy({ transaction: t });
      await admin.adminProfile.destroy({ transaction: t });
    });

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (err) {
    console.error("Delete admin error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete admin",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Restore soft-deleted admin
exports.restoreAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the admin user including soft-deleted records
    const admin = await User.findOne({
      where: { id, accountType: "admin" },
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
          paranoid: false,
        },
      ],
      paranoid: false,
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (!admin.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Admin is not deleted",
      });
    }

    // Restore in transaction
    await sequelize.transaction(async (t) => {
      await admin.restore({ transaction: t });
      if (admin.adminProfile && admin.adminProfile.deletedAt) {
        await admin.adminProfile.restore({ transaction: t });
      }
    });

    // Get restored admin data
    const restoredAdmin = await User.findByPk(id, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
      ],
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      message: "Admin restored successfully",
      data: restoredAdmin,
    });
  } catch (err) {
    console.error("Restore admin error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to restore admin",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
