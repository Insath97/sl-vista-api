const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Activities = require("../../models/activities.model");
const ActivitiesImages = require("../../models/activitesimages.model");
const UploadService = require("../../helpers/upload");
const { Op } = require("sequelize");

// 🔧 Helper function to upload images for Activities
const handleActivityImageUploads = async (files, activityId) => {
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

//Create Activity Controller
exports.createActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { ...activityData } = req.body;

    // Generate slug if not provided
    if (!activityData.slug && activityData.title) {
      activityData.slug = slugify(activityData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Create the Activity
    const activity = await Activities.create(activityData);

    // Handle image uploads
    const images = await handleActivityImageUploads(req.files, activity.id);
    if (images.length > 0) {
      await ActivitiesImages.bulkCreate(images);
    }

    // Fetch full activity with images
    const fullActivity = await Activities.findByPk(activity.id, {
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
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

// Get all Activities
exports.getAllActivities = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const {
      isActive,
      includeDeleted,
      includeImages,
      search,
      city,
      district,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [];

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    if (city) where.city = city;
    if (district) where.district = district;

    if (includeImages === "true") {
      include.push({
        model: ActivitiesImages,
        as: "images",
        separate: true,
        order: [["sortOrder", "ASC"]],
      });
    }

    const result = await Activities.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: includeDeleted !== "true", // include soft-deleted if true
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Activities fetched successfully",
      data: result.rows,
      pagination: {
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(result.count / limit),
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

//Get by id

exports.getActivityById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { includeDeleted } = req.query;

    const options = {
      where: { id: req.params.id },
      include: [
        {
          model: ActivitiesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
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

//  Update Activity
exports.updateActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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

    // Handle uploaded files
    const uploadedImages = await handleActivityImageUploads(
      req.files,
      activity.id
    );
    newImages = [...uploadedImages];

    // Merge manually submitted images (e.g., via JSON)
    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          activityId: activity.id,
        })),
      ];
    }

    // 🌀 Auto-slug if title is changed
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

    //  Update activity fields
    await activity.update(updateData);

    // Replace all images
    if (newImages.length > 0) {
      await ActivitiesImages.destroy({
        where: { activityId: activity.id },
      });
      await ActivitiesImages.bulkCreate(newImages);
    }

    // Return full updated activity with images
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

//  Delete Activity
exports.deleteActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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

    //  Collect all S3 keys
    const s3Keys = activity.images.map((img) => img.s3Key).filter(Boolean);

    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    // Soft delete
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

// Restore soft-deleted Activity
exports.restoreActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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

//Toggle Activity Active Status
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const activity = await Activities.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const newStatus = !activity.isActive;
    await activity.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Activity status toggled successfully",
      data: {
        id: activity.id,
        isActive: newStatus,
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

//Verify Activity
exports.verifyActivity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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
        : activity.vista !== "Verified";

    await activity.update({
      vista: newVerifiedStatus ? "Verified" : "Not Verified",
    });

    return res.status(200).json({
      success: true,
      message: "Activity verification status updated",
      data: {
        id: activity.id,
        vista: newVerifiedStatus ? "Verified" : "Not Verified",
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

//Update Activity Images
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const activity = await Activities.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const images = await handleActivityImageUploads(req.files, activity.id);

    if (images.length > 0) {
      await ActivitiesImages.destroy({
        where: { activityId: activity.id },
      });

      await ActivitiesImages.bulkCreate(images);
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

//Delete Activity Image
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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

//  Set Featured Activity Image
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    // Remove existing featured image for the activity
    await ActivitiesImages.update(
      { isFeatured: false },
      {
        where: {
          activityId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set new featured image
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