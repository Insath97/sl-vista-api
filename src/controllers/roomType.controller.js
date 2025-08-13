const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const RoomType = require("../models/roomType.model");
const User = require("../models/user.model");
const MerchantProfile = require("../models/merchantProfile.model");

// Helper to check business type access
const checkBusinessTypeAccess = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: MerchantProfile,
        as: "merchantProfile",
        attributes: ["businessType"],
      },
    ],
  });

  if (
    user?.accountType === "merchant" &&
    user?.merchantProfile?.businessType === "homestay"
  ) {
    throw new Error("Your business type does not allow room type management");
  }
};

/* Create Room Type */
exports.createRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    await checkBusinessTypeAccess(req.user.id);

    const roomType = await RoomType.create({
      ...req.body,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Room type created successfully",
      data: roomType,
    });
  } catch (error) {
    console.error("Error creating room type:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get All Room Types */
exports.getAllRoomTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      includeDeleted,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const where = {};

    // Apply filters
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Handle boolean filters
    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    const options = {
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
    };

    const { count, rows: roomTypes } = await RoomType.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: roomTypes,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching room types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room types",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get Room Type by ID */
exports.getRoomTypeById = async (req, res) => {
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

    const roomType = await RoomType.findOne(options);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: roomType,
    });
  } catch (error) {
    console.error("Error fetching room type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update Room Type */
exports.updateRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    await checkBusinessTypeAccess(req.user.id);

    const roomType = await RoomType.findByPk(req.params.id);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    await roomType.update(req.body);

    return res.status(200).json({
      success: true,
      message: "Room type updated successfully",
      data: roomType,
    });
  } catch (error) {
    console.error("Error updating room type:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete Room Type */
exports.deleteRoomType = async (req, res) => {
  try {
    await checkBusinessTypeAccess(req.user.id);

    const roomType = await RoomType.findByPk(req.params.id);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    await roomType.destroy();

    return res.status(200).json({
      success: true,
      message: "Room type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room type:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore Room Type */
exports.restoreRoomType = async (req, res) => {
  try {
    await checkBusinessTypeAccess(req.user.id);

    const roomType = await RoomType.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    if (roomType.deletedAt === null) {
      return res.status(400).json({
        success: false,
        message: "Room type is not deleted",
      });
    }

    await roomType.restore();

    return res.status(200).json({
      success: true,
      message: "Room type restored successfully",
      data: roomType,
    });
  } catch (error) {
    console.error("Error restoring room type:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to restore room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle Active Status */
exports.toggleRoomTypeStatus = async (req, res) => {
  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update room type status",
      });
    }

    const roomType = await RoomType.findByPk(req.params.id);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    const newStatus =
      req.body.isActive !== undefined ? req.body.isActive : !roomType.isActive;

    await roomType.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Room type status updated successfully",
      data: {
        id: roomType.id,
        isActive: newStatus,
      },
    });
  } catch (error) {
    console.error("Error updating room type status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room type status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
