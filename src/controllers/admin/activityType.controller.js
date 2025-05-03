const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const ActivityType = require("../../models/activityType.model");

/* create activity type */
exports.createActivityType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, language_code, icon, isActive } = req.body;
    const activityType = await ActivityType.create({
      name,
      language_code,
      icon,
      isActive: isActive !== false, // Default to true if not provided
    });

    return res.status(201).json({
      success: true,
      data: activityType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create activity type",
      error: error.message,
    });
  }
};

/* get all activity types */
exports.getAllActivityTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { language_code, isActive, search } = req.query;

    const where = {};
    if (language_code) where.language_code = language_code;
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (isActive !== undefined) where.isActive = isActive === "true";

    const activityTypes = await ActivityType.findAll({ where });
    return res.status(200).json({
      success: true,
      data: activityTypes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity types",
      error: error.message,
    });
  }
};

/* get activity type by id */
exports.getActivityTypeById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityType = await ActivityType.findByPk(req.params.id);
    if (!activityType) {
      return res.status(404).json({
        success: false,
        message: "Activity type not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: activityType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity type",
      error: error.message,
    });
  }
};

/* update activity type */
exports.updateActivityType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityType = await ActivityType.findByPk(req.params.id);
    if (!activityType) {
      return res.status(404).json({
        success: false,
        message: "Activity type not found",
      });
    }

    const { name, language_code, icon, isActive } = req.body;
    await activityType.update({
      name: name || activityType.name,
      language_code: language_code || activityType.language_code,
      icon: icon !== undefined ? icon : activityType.icon,
      isActive: isActive !== undefined ? isActive : activityType.isActive,
    });

    return res.status(200).json({
      success: true,
      data: activityType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update activity type",
      error: error.message,
    });
  }
};

/* soft delete activity type */
exports.deleteActivityType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityType = await ActivityType.findByPk(req.params.id);
    if (!activityType) {
      return res.status(404).json({
        success: false,
        message: "Activity type not found",
      });
    }

    await activityType.destroy();
    return res.status(200).json({
      success: true,
      message: "Activity type deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete activity type",
      error: error.message,
    });
  }
};

/* restore activity type */
exports.restoreActivityType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityType = await ActivityType.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!activityType) {
      return res.status(404).json({
        success: false,
        message: "Activity type not found (including soft-deleted)",
      });
    }

    if (!activityType.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Activity type is not deleted",
      });
    }

    await activityType.restore();
    return res.status(200).json({
      success: true,
      message: "Activity type restored successfully",
      data: activityType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to restore activity type",
      error: error.message,
    });
  }
};

/* change activity type status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityType = await ActivityType.findByPk(req.params.id);
    if (!activityType) {
      return res.status(404).json({
        success: false,
        message: "Activity type not found",
      });
    }

    const newStatus = !activityType.isActive;
    await activityType.update({ isActive: newStatus });
    return res.status(200).json({
      success: true,
      data: {
        isActive: newStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle status",
      error: error.message,
    });
  }
};
