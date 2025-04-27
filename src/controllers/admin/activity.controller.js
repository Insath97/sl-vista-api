// controllers/activityController.js
const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Activity = require("../../models/activity.model");
const {
  handleImageUpload,
  saveImagePaths,
  deleteImageFiles,
} = require("../../helpers/imageUpload");

// Image Upload Middleware
exports.uploadImages = handleImageUpload("images");

const includeOptions = [
  {
    association: "images",
    attributes: ["id", "imagePath", "isFeatured", "caption"],
  },
];

// Create Activity
exports.createActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const activity = await Activity.create(req.body);

    if (req.files?.length) {
      await saveImagePaths("Activity", activity.id, req.files);
    }

    const createdActivity = await Activity.findByPk(activity.id, {
      include: includeOptions,
    });

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: createdActivity,
    });
  } catch (error) {
    console.error("Error creating activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create activity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Activities
exports.getAllActivities = async (req, res) => {
  try {
    const { includeInactive, city, search } = req.query;
    const where = {};

    if (!includeInactive) where.isActive = true;
    if (city) where.city = city;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const activities = await Activity.findAll({
      where,
      include: includeOptions,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
    });
  }
};

// Get Activity by ID
exports.getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id, {
      include: includeOptions,
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity",
    });
  }
};

// Update Activity
exports.updateActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Handle slug regeneration if title changed
    if (req.body.title && req.body.title !== activity.title) {
      req.body.slug = slugify(req.body.title, { lower: true, strict: true });
    }

    await activity.update(req.body);

    // Handle image upload if files exist
    if (req.files?.length) {
      // Delete existing images first
      await deleteImageFiles("Activity", activity.id);
      // Save new images
      await saveImagePaths("Activity", activity.id, req.files);
    }

    const updatedActivity = await Activity.findByPk(activity.id, {
      include: includeOptions,
    });

    return res.status(200).json({
      success: true,
      message: "Activity updated successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update activity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Activity
exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Delete associated images
    await deleteImageFiles("Activity", activity.id);

    // Delete the activity
    await activity.destroy();

    return res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete activity",
    });
  }
};

// Restore Activity
exports.restoreActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found (including soft-deleted)",
      });
    }

    if (!activity.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Activity is not deleted",
      });
    }

    await activity.restore();
    return res.status(200).json({
      success: true,
      message: "Activity restored successfully",
      data: activity,
    });
  } catch (error) {
    console.error("Error restoring activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore activity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Toggle Activity Status
exports.toggleStatus = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    activity.isActive = !activity.isActive;
    await activity.save();

    return res.status(200).json({
      success: true,
      message: "Activity status toggled",
      data: activity,
    });
  } catch (error) {
    console.error("Error toggling activity status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle activity status",
    });
  }
};
