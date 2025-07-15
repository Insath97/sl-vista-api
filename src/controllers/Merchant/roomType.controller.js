const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const RoomType = require("../../models/roomType.model");

// Helper function to build where clause for queries
const buildWhereClause = (query) => {
  const where = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true";
  }

  if (query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query.search}%` } },
      { description: { [Op.like]: `%${query.search}%` } },
    ];
  }

  return where;
};

/* Create room type */
exports.createRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const roomType = await RoomType.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Room type created successfully",
      data: roomType,
    });
  } catch (error) {
    console.error("Error creating room type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all room types */
exports.getAllRoomTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      page = 1,
      limit = 10,
      search,
      includeInactive,
      includeDeleted,
    } = req.query;

    const where = buildWhereClause(req.query);

    const options = {
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
    };

    if (includeInactive !== "true") {
      where.isActive = true;
    }

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

/* Get room type by ID */
exports.getRoomTypeById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;

    const roomType = await RoomType.findOne({
      where: { id: req.params.id },
      paranoid: includeDeleted !== "true",
    });

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

/* Update room type */
exports.updateRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
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
      message: "Failed to update room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete room type */
exports.deleteRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
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
      message: "Failed to delete room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore room type */
exports.restoreRoomType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const roomType = await RoomType.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found (including soft-deleted)",
      });
    }

    if (!roomType.deletedAt) {
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
      message: "Failed to restore room type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle room type active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const roomType = await RoomType.findByPk(req.params.id);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    await roomType.update({ isActive: !roomType.isActive });

    return res.status(200).json({
      success: true,
      message: "Room type status toggled successfully",
      data: {
        id: roomType.id,
        isActive: !roomType.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling room type status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle room type status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
