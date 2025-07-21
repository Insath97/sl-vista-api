const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const AdminProfile = require("../models/adminProfile.model");
const UserRole = require("../models/userRole.model");
const Permission = require("../models/permisson.model");

exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email, password, roleIds, ...profileData } = req.body;

    // Check if email exists in User table
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create the user
    const user = await User.create({
      email,
      password,
      accountType: "admin",
    });

    // Create admin profile
    await AdminProfile.create({
      userId: user.id,
      ...profileData,
    });

    // Assign role if provided
    if (roleId) {
      // Verify role exists and is an admin role
      const role = await Role.findOne({
        where: {
          id: roleId,
          userType: "admin",
        },
        include: [{ model: Permission, as: "permissions" }],
      });

      if (!role) {
        // Clean up if role assignment fails
        await user.destroy();
        return res.status(400).json({
          success: false,
          message: "Role is invalid or not an admin role",
        });
      }

      // Assign single role to user
      await UserRole.create({
        userId: user.id,
        roleId: role.id,
      });
    }

    const newUser = await User.findByPk(user.id, {
      include: [
        {
          model: AdminProfile,
          as: "adminProfile",
        },
        {
          model: Role,
          as: "roles",
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
          through: { attributes: [] },
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
    console.error("Error creating admin user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
