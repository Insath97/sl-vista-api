const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const LocalArtistType = require("../../models/localArtistType.model");

/* create local artist type */
exports.createLocalArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.create(req.body);
    return res.status(201).json({
      success: true,
      data: localArtistType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create local artist type",
    });
  }
};

/* get all local artist type */
exports.getAllLocalArtistTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { language_code, includeInactive, search } = req.query;

    const where = {};
    if (language_code) where.language_code = language_code;
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (includeInactive !== "true") where.isActive = true;

    const localArtistTypes = await LocalArtistType.findAll({ where });
    return res.status(200).json({
      success: true,
      data: localArtistTypes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch local artist types",
    });
  }
};

/* get local artist type by id */
exports.getLocalArtistTypeById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.findByPk(req.params.id);
    if (!localArtistType) {
      return res.status(404).json({
        success: false,
        message: "Local artist type not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: localArtistType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch local artist type",
    });
  }
};

/* update local aertist type */
exports.updateLocalArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.findByPk(req.params.id);
    if (!localArtistType) {
      return res.status(404).json({
        success: false,
        message: "Local artist type not found",
      });
    }

    await localArtistType.update(req.body);
    return res.status(200).json({
      success: true,
      data: localArtistType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update local artist type",
    });
  }
};

/* soft delet local artist type*/
exports.deleteLocalArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.findByPk(req.params.id);
    if (!localArtistType) {
      return res.status(404).json({
        success: false,
        message: "Local artist type not found",
      });
    }

    await localArtistType.destroy();
    return res.status(200).json({
      success: true,
      message: "Local artist type deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete local artist type",
    });
  }
};

/* restore local artist type */
exports.restoreLocalArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!localArtistType) {
      return res.status(404).json({
        success: false,
        message: "Local artist type not found (including soft-deleted)",
      });
    }

    if (!localArtistType.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Local artist type is not deleted",
      });
    }

    await localArtistType.restore();
    return res.status(200).json({
      success: true,
      message: "Local artist type restored successfully",
      data: localArtistType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to restore local artist type",
    });
  }
};

/* change local artist type status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const localArtistType = await LocalArtistType.findByPk(req.params.id);
    if (!localArtistType) {
      return res.status(404).json({
        success: false,
        message: "Local artist type not found",
      });
    }

    await localArtistType.update({ isActive: !localArtistType.isActive });
    return res.status(200).json({
      success: true,
      data: {
        isActive: !localArtistType.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle status",
    });
  }
};
