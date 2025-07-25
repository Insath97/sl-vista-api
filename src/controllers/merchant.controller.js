const { validationResult } = require("express-validator");
const { sequelize } = require("../config/database");
const User = require("../models/user.model");
const MerchantProfile = require("../models/merchantProfile.model");
const Role = require("../models/role.model");
const UserRole = require("../models/userRole.model");

// Register new merchant (initial registration with pending status)
exports.registerMerchant = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      merchantName,
      businessName,
      businessRegistrationNumber,
      businessType,
      email,
      password,
      isSriLankan,
      nicNumber,
      passportNumber,
      address,
      city,
      country,
      phoneNumber,
      businessDescription,
    } = req.body;

    const result = await sequelize.transaction(async (t) => {
      const user = await User.create(
        {
          email,
          password,
          accountType: "merchant",
          isActive: true,
        },
        { transaction: t }
      );

      const merchantProfile = await MerchantProfile.create(
        {
          userId: user.id,
          merchantName,
          businessName,
          businessRegistrationNumber,
          businessType,
          isSriLankan,
          nicNumber: isSriLankan ? nicNumber : null,
          passportNumber: !isSriLankan ? passportNumber : null,
          address,
          city,
          country,
          phoneNumber,
          businessDescription,
          status: "pending",
          maxPropertiesAllowed: 1,
        },
        { transaction: t }
      );

      return { user, merchantProfile };
    });

    const userData = result.user.toJSON();
    const merchantData = result.merchantProfile.toJSON();

    res.status(201).json({
      success: true,
      message: "Merchant registration submitted for approval",
      data: {
        ...userData,
        merchantProfile: merchantData,
      },
    });
  } catch (err) {
    console.error("Merchant registration error:", err);

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

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: err.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: List all merchants with filters
exports.listMerchants = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      businessType,
      isSriLankan,
      country,
      city,
      search,
    } = req.query;

    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (businessType) where.businessType = businessType;
    if (isSriLankan) where.isSriLankan = isSriLankan === "true";
    if (country) where.country = country;
    if (city) where.city = city;

    if (search) {
      where[sequelize.Op.or] = [
        { businessName: { [sequelize.Op.like]: `%${search}%` } },
        { merchantName: { [sequelize.Op.like]: `%${search}%` } },
        { businessRegistrationNumber: { [sequelize.Op.like]: `%${search}%` } },
        { "$user.email$": { [sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await MerchantProfile.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "accountType", "isActive", "createdAt"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: offset,
      paranoid: false, // Include soft-deleted records
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("Error listing merchants:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: Approve merchant
exports.approveMerchant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { allowedPropertyTypes, maxPropertiesAllowed, adminNotes, roleId } =
      req.body;

    // First verify the role exists
    const role = await Role.findByPk(roleId);
    if (!role || role.userType !== "merchant") {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant role ID",
      });
    }

    const merchant = await MerchantProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    // Add null checks for merchant and merchant.user
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    if (!merchant.user) {
      return res.status(404).json({
        success: false,
        message: "User account not found for this merchant",
      });
    }

    if (merchant.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Merchant is not in pending status",
      });
    }

    // Determine allowed property types
    let finalAllowedTypes = allowedPropertyTypes;
    if (!finalAllowedTypes || finalAllowedTypes.length === 0) {
      switch (merchant.businessType) {
        case "hotel_and_appartment":
          finalAllowedTypes = ["hotel", "appartment"];
          break;
        case "homestay":
          finalAllowedTypes = ["homestay"];
          break;
        case "both":
          finalAllowedTypes = ["hotel", "appartment", "homestay"];
          break;
        default:
          finalAllowedTypes = ["other"];
      }
    }

    await sequelize.transaction(async (t) => {
      // Update merchant profile
      await merchant.update(
        {
          status: "active",
          allowedPropertyTypes: finalAllowedTypes,
          maxPropertiesAllowed: maxPropertiesAllowed || 5,
          verificationDate: new Date(),
          adminNotes,
        },
        { transaction: t }
      );

      // Remove all existing roles
      await UserRole.destroy({
        where: {
          userId: merchant.user.id,
        },
        transaction: t,
      });

      // Assign the new role
      await UserRole.create(
        {
          userId: merchant.user.id,
          roleId: roleId,
          assignedBy: req.user?.id || null, // Add null check for req.user
        },
        { transaction: t }
      );
    });

    // Fetch updated merchant with role
    const updatedMerchant = await MerchantProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          include: [
            {
              model: Role,
              as: "roles",
              through: { attributes: [] },
              attributes: ["id", "name", "description"],
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: "Merchant approved successfully",
      data: updatedMerchant,
    });
  } catch (err) {
    console.error("Error approving merchant:", err);

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

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: err.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: Reject merchant
exports.rejectMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const merchant = await MerchantProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    if (merchant.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Merchant is not in pending status",
      });
    }

    await sequelize.transaction(async (t) => {
      // Update merchant profile
      await merchant.update(
        {
          isActive: false,
          status: "rejected",
          adminNotes: rejectionReason,
        },
        { transaction: t }
      );

      // Deactivate the associated user account
      if (merchant.user) {
        await merchant.user.update(
          {
            isActive: false,
          },
          { transaction: t }
        );
      }
    });

    res.json({
      success: true,
      message: "Merchant registration rejected and account deactivated",
    });
  } catch (err) {
    console.error("Error rejecting merchant:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: Update merchant status
exports.updateMerchantStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { status, suspensionReason, adminNotes } = req.body;

    const merchant = await MerchantProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Determine if we need to deactivate the account
    const shouldDeactivate = ["inactive", "suspended", "rejected"].includes(
      status
    );
    const shouldActivate = status === "active";

    await sequelize.transaction(async (t) => {
      // Update merchant profile
      const updates = { status, adminNotes };
      if (status === "suspended") {
        updates.suspensionReason = suspensionReason;
      }

      // Update isActive in MerchantProfile
      updates.isActive = !shouldDeactivate;

      await merchant.update(updates, { transaction: t });

      // Update user account status if exists
      if (merchant.user) {
        const userUpdates = { isActive: !shouldDeactivate };

        // Special case for rejected status - deactivate both
        if (status === "rejected") {
          userUpdates.isActive = false;
          await merchant.update({ isActive: false }, { transaction: t });
        }

        await merchant.user.update(userUpdates, { transaction: t });
      }
    });

    res.json({
      success: true,
      message: `Merchant status updated to ${status} successfully`,
    });
  } catch (err) {
    console.error("Error updating merchant status:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Update merchant details
exports.updateMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find merchant with associated user
    const merchant = await MerchantProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Check permissions
    const isAdmin = req.user.accountType === "admin";
    const isSelfUpdate = req.user.id === merchant.user.id;

    if (!isAdmin && !isSelfUpdate) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile",
      });
    }

    // Fields merchants are allowed to update
    const merchantAllowedUpdates = {
      merchantName: updates.merchantName,
      businessName: updates.businessName,
      address: updates.address,
      city: updates.city,
      country: updates.country,
      phoneNumber: updates.phoneNumber,
      businessDescription: updates.businessDescription,
    };

    // For admin - can update everything including sensitive fields
    const adminAllowedUpdates = {
      ...updates, // All fields from request
      ...(updates.password && {
        password: await bcrypt.hash(updates.password, 12),
      }),
    };

    // Apply updates based on role
    if (isAdmin) {
      // Admin can update everything
      await sequelize.transaction(async (t) => {
        // Update merchant profile
        await merchant.update(adminAllowedUpdates, { transaction: t });

        // Update user email if provided
        if (updates.email) {
          await merchant.user.update(
            { email: updates.email },
            { transaction: t }
          );
        }

        if (updates.password) {
          await merchant.user.update(
            { password: updates.password },
            { transaction: t }
          );
        }
      });
    } else {
      // Merchant can only update allowed fields
      await merchant.update(merchantAllowedUpdates);
    }

    // Fetch updated merchant data
    const updatedMerchant = await MerchantProfile.findByPk(id, {
      include: [{ model: User, as: "user", attributes: ["id", "email"] }],
    });

    res.json({
      success: true,
      message: "Merchant updated successfully",
      data: updatedMerchant,
    });
  } catch (err) {
    console.error("Error updating merchant:", err);

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

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: err.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: Delete merchant (soft delete)
exports.deleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await MerchantProfile.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    await sequelize.transaction(async (t) => {
      // Soft delete merchant profile
      await merchant.destroy({ transaction: t });

      // Also soft delete the associated user
      if (merchant.user) {
        await merchant.user.destroy({ transaction: t });
      }
    });

    res.json({
      success: true,
      message: "Merchant deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting merchant:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin: Restore deleted merchant
exports.restoreMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await MerchantProfile.findByPk(id, {
      paranoid: false,
      include: [{ model: User, as: "user", paranoid: false }],
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    if (!merchant.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Merchant is not deleted",
      });
    }

    await sequelize.transaction(async (t) => {
      // Restore merchant profile
      await merchant.restore({ transaction: t });

      // Also restore the associated user
      if (merchant.user) {
        await merchant.user.restore({ transaction: t });
      }
    });

    res.json({
      success: true,
      message: "Merchant restored successfully",
      data: merchant,
    });
  } catch (err) {
    console.error("Error restoring merchant:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
