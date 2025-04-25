const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const TransportType = require("../../models/transportType.model");

/* Create transport type */
exports.createTransportType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transportType = await TransportType.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Transport type created successfully",
      data: transportType,
    });
  } catch (error) {
    console.error("Error creating transport type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transport type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all transport types */
exports.getAllTransportTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { language_code, isActive } = req.query;
    const where = {};

    if (language_code) where.language_code = language_code;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const transportTypes = await TransportType.findAll({ where });
    return res.status(200).json({ success: true, data: transportTypes });
  } catch (error) {
    console.error("Error fetching transport types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport types",
    });
  }
};

/* Get transport type by ID */
exports.getTransportTypeById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transportType = await TransportType.findByPk(req.params.id);
    if (!transportType) {
      return res.status(404).json({
        success: false,
        message: "Transport type not found",
      });
    }
    return res.status(200).json({ success: true, data: transportType });
  } catch (error) {
    console.error("Error fetching transport type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport type",
    });
  }
};

/* Update transport type */
exports.updateTransportType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transportType = await TransportType.findByPk(req.params.id);
    if (!transportType) {
      return res.status(404).json({
        success: false,
        message: "Transport type not found",
      });
    }

    const updateData = { ...req.body };

    // Only generate new slug if name is being updated and slug isn't provided
    if (
      updateData.name &&
      !updateData.slug &&
      updateData.name !== transportType.name
    ) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Validate the slug won't conflict with others
    if (updateData.slug) {
      const existing = await TransportType.findOne({
        where: {
          slug: updateData.slug,
          id: { [Op.ne]: req.params.id },
        },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Slug is already in use by another transport type",
        });
      }
    }

    await transportType.update(updateData, { validate: true });

    // Fetch the updated record to return complete data
    const updatedTransportType = await TransportType.findByPk(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Transport type updated successfully",
      data: updatedTransportType,
    });
  } catch (error) {
    console.error("Error updating transport type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport type */
exports.deleteTransportType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transportType = await TransportType.findByPk(req.params.id);
    if (!transportType) {
      return res.status(404).json({
        success: false,
        message: "Transport type not found",
      });
    }

    await transportType.destroy();
    return res.status(200).json({
      success: true,
      message: "Transport type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport type",
    });
  }
};

/* Restore soft-deleted transport type */
exports.restoreTransportType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Find including soft-deleted records
    const transportType = await TransportType.findOne({
      where: { id: req.params.id },
      paranoid: false, // This includes soft-deleted records
    });

    if (!transportType) {
      return res.status(404).json({
        success: false,
        message: "Transport type not found (including soft-deleted)",
      });
    }

    if (!transportType.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport type is not deleted",
      });
    }

    // Restore the record
    await transportType.restore();

    // Fetch the restored record to return complete data
    const restoredTransportType = await TransportType.findByPk(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Transport type restored successfully",
      data: restoredTransportType,
    });
  } catch (error) {
    console.error("Error restoring transport type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore transport type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle visibility */
exports.toggleVisibility = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transportType = await TransportType.findByPk(req.params.id);
    if (!transportType) {
      return res.status(404).json({
        success: false,
        message: "Transport type not found",
      });
    }

    await transportType.toggleVisibility();
    return res.status(200).json({
      success: true,
      message: "Transport type visibility toggled",
      data: transportType,
    });
  } catch (error) {
    console.error("Error toggling transport type visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle visibility",
    });
  }
};
