const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Amenity = require("../../models/amenity.model");

// Create amenity
exports.createAmenity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const amenity = await Amenity.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Amenity created successfully",
      data: amenity,
    });
  } catch (error) {
    console.error("Error creating amenity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create amenity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all amenities with advanced filtering
exports.getAllAmenities = async (req, res) => {
  try {
    const {
      includeInactive,
      search,
      language_code,
      sortBy = "name", // Changed from 'position' to 'name' as default
      sortOrder = "ASC",
      page = 1,
      pageSize = 10,
    } = req.query;

    // Validate sortBy to prevent SQL injection
    const validSortFields = [
      "name",
      "slug",
      "isActive",
      "createdAt",
      "updatedAt",
    ];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "name";

    // Build where clause
    const where = {};

    if (language_code) {
      where.language_code = language_code;
    }

    if (search) {
      where.name = {
        [Op.iLike]: `%${search}%`, // Case-insensitive search
      };
    }

    // Build options
    const options = {
      where,
      order: [[finalSortBy, sortOrder.toUpperCase()]],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
    };

    // Apply scope based on includeInactive
    const amenities = await Amenity.scope(
      includeInactive === "true" ? "withInactive" : null
    ).findAll(options);

    // Get total count for pagination
    const totalCount = await Amenity.scope(
      includeInactive === "true" ? "withInactive" : null
    ).count({ where });

    return res.status(200).json({
      success: true,
      data: amenities,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get amenity by ID
exports.getAmenityById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const amenity = await Amenity.findByPk(req.params.id);
    if (!amenity) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found" });
    }
    return res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    console.error("Error fetching amenity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenity",
    });
  }
};

// Update amenity
exports.updateAmenity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const amenity = await Amenity.findByPk(req.params.id);
    if (!amenity) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found" });
    }

    const updateData = { ...req.body };
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    await amenity.update(updateData);
    return res.status(200).json({
      success: true,
      message: "Amenity updated successfully",
      data: amenity,
    });
  } catch (error) {
    console.error("Error updating amenity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update amenity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete amenity
exports.deleteAmenity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const amenity = await Amenity.findByPk(req.params.id);
    if (!amenity) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found" });
    }

    await amenity.destroy();
    return res.status(200).json({
      success: true,
      message: "Amenity deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting amenity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete amenity",
    });
  }
};

// Get amenity by slug
exports.getAmenityBySlug = async (req, res) => {
  try {
    const amenity = await Amenity.findOne({ where: { slug: req.params.slug } });
    if (!amenity) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found" });
    }
    return res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    console.error("Error fetching amenity by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenity",
    });
  }
};

// Restore soft-deleted amenity
exports.restoreAmenity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const amenity = await Amenity.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found (including soft-deleted)",
      });
    }

    if (!amenity.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Amenity is not deleted",
      });
    }

    await amenity.restore();
    return res.status(200).json({
      success: true,
      message: "Amenity restored successfully",
      data: amenity,
    });
  } catch (error) {
    console.error("Error restoring amenity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore amenity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Toggle amenity visibility
exports.toggleVisibility = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    // Remove default scope to find both active and inactive amenities
    const amenity = await Amenity.scope("withInactive").findByPk(req.params.id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found (including inactive)",
      });
    }

    await amenity.toggleVisibility();

    return res.status(200).json({
      success: true,
      message: "Amenity visibility toggled",
      data: {
        id: amenity.id,
        name: amenity.name,
        isActive: amenity.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling amenity visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle visibility",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
