const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Transport = require("../../models/transport.model");
const TransportImage = require("../../models/transportImage.model");
const {
  handleImageUpload,
  saveImagePaths,
} = require("../../helpers/imageUpload");

// Create Transport
exports.createTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.create(req.body);

    // Handle image upload if files exist
    if (req.files && req.files.length > 0) {
      await saveImagePaths("Transport", transport.id, req.files);
    }

    const createdTransport = await Transport.findByPk(transport.id, {
      include: ["images", "transportType"],
    });

    return res.status(201).json({
      success: true,
      message: "Transport created successfully",
      data: createdTransport,
    });
  } catch (error) {
    console.error("Error creating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Transports
exports.getAllTransports = async (req, res) => {
  try {
    const transports = await Transport.scope(
      req.query.includeInactive === "true" ? "withInactive" : null
    ).findAll({
      include: ["images", "transportType"],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: transports,
    });
  } catch (error) {
    console.error("Error fetching transports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
    });
  }
};

// Get Transport by ID
exports.getTransportById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.scope(
      req.query.includeInactive === "true" ? "withInactive" : null
    ).findByPk(req.params.id, {
      include: ["images", "transportType", "amenities"],
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error("Error fetching transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport",
    });
  }
};

// Update Transport
exports.updateTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    const updateData = { ...req.body };
    if (updateData.title && !updateData.slug) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
      });
    }

    await transport.update(updateData);

    // Handle image upload if files exist
    if (req.files && req.files.length > 0) {
      await saveImagePaths("Transport", transport.id, req.files);
    }

    const updatedTransport = await Transport.findByPk(transport.id, {
      include: ["images", "transportType"],
    });

    return res.status(200).json({
      success: true,
      message: "Transport updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Soft Delete Transport
exports.deleteTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    await transport.destroy();
    return res.status(200).json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport",
    });
  }
};

// Restore Soft-deleted Transport
exports.restoreTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found (including soft-deleted)",
      });
    }

    if (!transport.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport is not deleted",
      });
    }

    await transport.restore();
    return res.status(200).json({
      success: true,
      message: "Transport restored successfully",
      data: transport,
    });
  } catch (error) {
    console.error("Error restoring transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Toggle Verified Status
exports.toggleVerified = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    await transport.toggleVerified();
    return res.status(200).json({
      success: true,
      message: "Transport verification status toggled",
      data: transport,
    });
  } catch (error) {
    console.error("Error toggling transport verification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle verification status",
    });
  }
};

// Upload Images Middleware
exports.uploadImages = handleImageUpload("images", "transport");
