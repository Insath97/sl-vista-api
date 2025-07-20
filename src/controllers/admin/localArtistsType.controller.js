const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const ArtistType = require("../../models/artistsType.model");

/* Create artist type */
exports.createArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const artistType = await ArtistType.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Artist type created successfully",
      data: artistType,
    });
  } catch (error) {
    console.error("Error creating artist type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create artist type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all artist types */
exports.getAllArtistTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { isActive, includeInactive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === "true";

    const artistTypes = await ArtistType.findAll({
      where,
      paranoid: includeInactive === "true" ? false : true,
    });

    return res.status(200).json({ success: true, data: artistTypes });
  } catch (error) {
    console.error("Error fetching artist types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch artist types",
    });
  }
};

/* Get artist type by ID */
exports.getArtistTypeById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const artistType = await ArtistType.findByPk(req.params.id);
    if (!artistType) {
      return res
        .status(404)
        .json({ success: false, message: "Artist type not found" });
    }

    return res.status(200).json({ success: true, data: artistType });
  } catch (error) {
    console.error("Error fetching artist type:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch artist type" });
  }
};

/* Update artist type */
exports.updateArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const artistType = await ArtistType.findByPk(req.params.id);
    if (!artistType) {
      return res
        .status(404)
        .json({ success: false, message: "Artist type not found" });
    }

    const updateData = { ...req.body };

    if (
      updateData.name &&
      !updateData.slug &&
      updateData.name !== artistType.name
    ) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    if (updateData.slug) {
      const existing = await ArtistType.findOne({
        where: {
          slug: updateData.slug,
          id: { [Op.ne]: req.params.id },
        },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Slug is already in use by another artist type",
        });
      }
    }

    await artistType.update(updateData, { validate: true });

    return res.status(200).json({
      success: true,
      message: "Artist type updated successfully",
      data: artistType,
    });
  } catch (error) {
    console.error("Error updating artist type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update artist type",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete artist type */
exports.deleteArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const artistType = await ArtistType.findByPk(req.params.id);
    if (!artistType) {
      return res
        .status(404)
        .json({ success: false, message: "Artist type not found" });
    }

    await artistType.destroy();

    return res.status(200).json({
      success: true,
      message: "Artist type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting artist type:", error);
    return res.status(500).json({
      success: false,
      message: error.message.includes("Cannot delete")
        ? error.message
        : "Failed to delete artist type",
    });
  }
};

/* Restore soft-deleted artist type */
exports.restoreArtistType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const artistType = await ArtistType.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!artistType) {
      return res.status(404).json({
        success: false,
        message: "Artist type not found (including soft-deleted)",
      });
    }

    if (!artistType.deletedAt) {
      return res
        .status(400)
        .json({ success: false, message: "Artist type is not deleted" });
    }

    await artistType.restore();

    const restored = await ArtistType.findByPk(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Artist type restored successfully",
      data: restored,
    });
  } catch (error) {
    console.error("Error restoring artist type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore artist type",
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
    const artistType = await ArtistType.findByPk(req.params.id);
    if (!artistType) {
      return res
        .status(404)
        .json({ success: false, message: "Artist type not found" });
    }

    await artistType.toggleVisibility();

    return res.status(200).json({
      success: true,
      message: "Artist type visibility toggled",
      data: {
        id: artistType.id,
        isActive: artistType.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling artist type visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle visibility",
    });
  }
};
