// controllers/transportController.js
const { Op } = require("sequelize");
const { validationResult } = require("express-validator");

const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const TransportImage = require("../../models/transportImage.model");
const TransportAmenity = require("../../models/transportAmenity.model");
const Amenity = require("../../models/amenity.model");
const slugify = require("slugify");

const {
  handleImageUpload,
  saveImagePaths,
  deleteImageFiles,
} = require("../../helpers/imageUpload");

const includeOptions = [
  {
    model: TransportType,
    attributes: ["id", "name", "slug"],
  },
  {
    model: TransportImage,
    attributes: ["id", "imagePath", "isFeatured"],
  },
  {
    model: Amenity,
    through: {
      attributes: ["isAvailable", "notes"],
      where: { isAvailable: true },
    },
    attributes: ["id", "name", "slug", "icon"],
  },
];

// Middleware
exports.uploadImages = handleImageUpload("transport");

// CRUD Operations
exports.createTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const transport = await Transport.create(req.body);

    if (req.files?.length) {
      await saveImagePaths("Transport", transport.id, req.files);
    }

    const result = await Transport.findByPk(transport.id, {
      include: includeOptions,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getAllTransports = async (req, res) => {
  try {
    const { includeInactive, transportType, search } = req.query;
    const where = {};

    if (!includeInactive) where.isActive = true;
    if (transportType) where.transportTypeId = transportType;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { operatorName: { [Op.like]: `%${search}%` } },
      ];
    }

    const transports = await Transport.findAll({
      where,
      include: includeOptions,
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, data: transports });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
    });
  }
};

exports.getTransportById = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id, {
      include: includeOptions,
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    res.json({ success: true, data: transport });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch transport",
    });
  }
};

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

    // Handle slug regeneration if title changed
    if (req.body.title && req.body.title !== transport.title) {
      req.body.slug = slugify(req.body.title, { lower: true, strict: true });
    }

    await transport.update(req.body);

    if (req.files?.length) {
      await deleteImageFiles("Transport", transport.id);
      await saveImagePaths("Transport", transport.id, req.files);
    }

    const result = await Transport.findByPk(transport.id, {
      include: includeOptions,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update transport",
    });
  }
};

exports.deleteTransport = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    await transport.destroy();
    res.json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete transport",
    });
  }
};

exports.restoreTransport = async (req, res) => {
  try {
    const transport = await Transport.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    if (!transport.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport is not deleted",
      });
    }

    await transport.restore();
    res.json({
      success: true,
      data: transport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to restore transport",
    });
  }
};

// Special Operations
exports.toggleStatus = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    transport.isActive = !transport.isActive;
    await transport.save();

    res.json({
      success: true,
      data: transport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle status",
    });
  }
};

exports.updateAmenities = async (req, res) => {
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

    await TransportAmenity.destroy({ where: { transportId: transport.id } });

    const amenities = req.body.amenities.map((amenity) => ({
      transportId: transport.id,
      amenityId: amenity.id,
      isAvailable: amenity.isAvailable !== false,
      notes: amenity.notes || null,
    }));

    await TransportAmenity.bulkCreate(amenities);

    const result = await Transport.findByPk(transport.id, {
      include: includeOptions,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update amenities",
    });
  }
};
