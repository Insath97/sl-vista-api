const { validationResult } = require("express-validator");
const slugify = require("slugify");
const { Op } = require("sequelize");
const Activities = require("../../models/activities.model");
const ActivitiesImages = require("../../models/activitesimages.model");
const UploadService = require("../../helpers/upload");

// Helper function to handle image uploads
const handleImageUploads = async (files, activityId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "activities", activityId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    activityId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

// Create Activity
exports.createActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activityData = req.body;

    // Generate slug if not provided
    if (!activityData.slug && activityData.title) {
      activityData.slug = slugify(activityData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const activity = await Activities.create(activityData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, activity.id);
    if (images.length > 0) {
      await activity.addImages(images);
    }

    const fullActivity = await Activities.findByPk(activity.id, {
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "activityId", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: fullActivity,
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vista,
      includeDeleted,
      page = 1,
      limit = 10,
      search,
      city,
      district,
      type,
    } = req.query;

    const where = {};
    const include = [
      {
        model: ActivitiesImages,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "activityId", "imageUrl", "fileName"],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vista) where.vista = vista;
    if (city) where.city = city;
    if (district) where.district = district;
    if (type) where.type = type;

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      include,
      distinct: true,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
    };

    const { count, rows: activities } = await Activities.findAndCountAll(
      options
    );

    return res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Activity by ID
exports.getActivityById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const options = {
      where: { id: req.params.id },
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "activityId", "imageUrl", "fileName"],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const activity = await Activities.findOne(options);

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
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Activity
exports.updateActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, activity.id);
    newImages = [...uploadedImages];

    // Handle body images
    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
        })),
      ];
    }

    // Update slug if title changed
    if (
      updateData.title &&
      !updateData.slug &&
      updateData.title !== activity.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update images
    if (newImages.length > 0) {
      await activity.updateImages(newImages);
    }

    await activity.update(updateData);

    const updatedActivity = await Activities.findByPk(activity.id, {
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "activityId", "imageUrl", "fileName"],
        },
      ],
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.findByPk(req.params.id, {
      include: [{ model: ActivitiesImages, as: "images" }],
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = activity.images.map((img) => img.s3Key).filter((key) => key);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

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
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Restore Activity
exports.restoreActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.findOne({
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

    const restoredActivity = await Activities.findByPk(req.params.id, {
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "activityId", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Activity restored successfully",
      data: restoredActivity,
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

// Toggle Active Status
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.scope("withInactive").findByPk(
      req.params.id
    );
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await activity.update({ isActive: !activity.isActive });

    return res.status(200).json({
      success: true,
      message: "Activity status toggled successfully",
      data: {
        id: activity.id,
        isActive: !activity.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling activity status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle activity status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify Activity
exports.verifyActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !activity.vistaVerified;

    await activity.update({
      vistaVerified: newVerifiedStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Activity verification status updated",
      data: {
        id: activity.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Images
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const activity = await Activities.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const images = await handleImageUploads(req.files, activity.id);

    if (images.length > 0) {
      await activity.updateImages(images);
    }

    const updatedActivity = await Activities.findByPk(activity.id, {
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Activity images updated successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("Error updating activity images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update activity images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Image
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const image = await ActivitiesImages.findOne({
      where: {
        id: req.params.imageId,
        activityId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this activity",
      });
    }

    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Activity image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting activity image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete activity image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Set Featured Image
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // First unset any currently featured image
    await ActivitiesImages.update(
      { isFeatured: false },
      {
        where: {
          activityId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await ActivitiesImages.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          activityId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this activity",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Featured image set successfully",
    });
  } catch (error) {
    console.error("Error setting featured image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set featured image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
