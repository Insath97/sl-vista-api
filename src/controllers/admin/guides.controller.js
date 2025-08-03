const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const slugify = require("slugify");
const Guides = require("../../models/guides.model");
const GuidesImages = require("../../models/guideImages.model");
const UploadService = require("../../helpers/upload");

// Helper function to handle image uploads
const handleImageUploads = async (files, guideId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "guides", guideId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    guideId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

// Create Guide
exports.createGuide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const guideData = req.body;

    // Handle array fields
    if (guideData.languages && typeof guideData.languages === 'string') {
      guideData.languages = guideData.languages.split(',').map(lang => lang.trim());
    }
    if (guideData.specialties && typeof guideData.specialties === 'string') {
      guideData.specialties = guideData.specialties.split(',').map(spec => spec.trim());
    }

    // Generate slug if not provided
    if (!guideData.slug && guideData.guide_name) {
      guideData.slug = slugify(guideData.guide_name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const guide = await Guides.create(guideData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, guide.id);
    if (images.length > 0) {
      await guide.addImages(images);
    }

    const fullGuide = await Guides.findByPk(guide.id, {
      include: [
        {
          model: GuidesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Guide created successfully",
      data: fullGuide,
    });
  } catch (error) {
    console.error("Error creating guide:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create guide",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Guides
exports.getAllGuides = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      includeDeleted,
      includeImages,
      page = 1,
      limit = 10,
      search,
      region,
      language,
      minExperience,
      maxExperience,
      minRate,
      maxRate,
      currency,
    } = req.query;

    const where = {};
    const include = [];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined) where.vistaVerified = vistaVerified === "true";
    if (region) where.region = region;
    if (language) where.languages = { [Op.like]: `%${language}%` };
    if (minExperience) where.experience = { [Op.gte]: parseInt(minExperience) };
    if (maxExperience) where.experience = { ...where.experience, [Op.lte]: parseInt(maxExperience) };
    if (minRate) where.ratePerDayAmount = { [Op.gte]: parseFloat(minRate) };
    if (maxRate) where.ratePerDayAmount = { ...where.ratePerDayAmount, [Op.lte]: parseFloat(maxRate) };
    if (currency) where.ratePerDayCurrency = currency;

    if (search) {
      where[Op.or] = [
        { guide_name: { [Op.like]: `%${search}%` } },
        { bio: { [Op.like]: `%${search}%` } },
        { specialties: { [Op.like]: `%${search}%` } },
      ];
    }

    if (includeImages === "true") {
      include.push({
        model: GuidesImages,
        as: "images",
        order: [["sortOrder", "ASC"]],
      });
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

    const { count, rows: guides } = await Guides.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: guides,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching guides:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guides",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Guide by ID
exports.getGuideById = async (req, res) => {
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
          model: GuidesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const guide = await Guides.findOne(options);

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: guide,
    });
  } catch (error) {
    console.error("Error fetching guide:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guide",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Guide
exports.updateGuide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const guide = await Guides.findByPk(req.params.id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle array fields
    if (updateData.languages && typeof updateData.languages === 'string') {
      updateData.languages = updateData.languages.split(',').map(lang => lang.trim());
    }
    if (updateData.specialties && typeof updateData.specialties === 'string') {
      updateData.specialties = updateData.specialties.split(',').map(spec => spec.trim());
    }

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, guide.id);
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

    // Update slug if name changed
    if (
      updateData.guide_name &&
      !updateData.slug &&
      updateData.guide_name !== guide.guide_name
    ) {
      updateData.slug = slugify(updateData.guide_name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update images
    if (newImages.length > 0) {
      await guide.updateImages(newImages);
    }

    await guide.update(updateData);

    const updatedGuide = await Guides.findByPk(guide.id, {
      include: [
        {
          model: GuidesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Guide updated successfully",
      data: updatedGuide,
    });
  } catch (error) {
    console.error("Error updating guide:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update guide",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Guide
exports.deleteGuide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const guide = await Guides.findByPk(req.params.id, {
      include: [{ model: GuidesImages, as: "images" }],
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = guide.images.map((img) => img.s3Key).filter((key) => key);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await guide.destroy();

    return res.status(200).json({
      success: true,
      message: "Guide deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting guide:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete guide",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Restore Guide
exports.restoreGuide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const guide = await Guides.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found (including soft-deleted)",
      });
    }

    if (!guide.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Guide is not deleted",
      });
    }

    await guide.restore();

    const restoredGuide = await Guides.findByPk(req.params.id, {
      include: [
        {
          model: GuidesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Guide restored successfully",
      data: restoredGuide,
    });
  } catch (error) {
    console.error("Error restoring guide:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore guide",
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
    const guide = await Guides.findByPk(req.params.id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    await guide.update({ isActive: !guide.isActive });

    return res.status(200).json({
      success: true,
      message: "Guide status toggled successfully",
      data: {
        id: guide.id,
        isActive: !guide.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling guide status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle guide status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify Guide
exports.verifyGuide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const guide = await Guides.findByPk(req.params.id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !guide.vistaVerified;

    await guide.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Guide verification status updated",
      data: {
        id: guide.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying guide:", error);
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
    const guide = await Guides.findByPk(req.params.id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    const images = await handleImageUploads(req.files, guide.id);

    if (images.length > 0) {
      await guide.updateImages(images);
    }

    const updatedGuide = await Guides.findByPk(guide.id, {
      include: [
        {
          model: GuidesImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Guide images updated successfully",
      data: updatedGuide,
    });
  } catch (error) {
    console.error("Error updating guide images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update guide images",
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
    const image = await GuidesImages.findOne({
      where: {
        id: req.params.imageId,
        guideId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this guide",
      });
    }

    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Guide image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting guide image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete guide image",
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
    await GuidesImages.update(
      { isFeatured: false },
      {
        where: {
          guideId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await GuidesImages.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          guideId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this guide",
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