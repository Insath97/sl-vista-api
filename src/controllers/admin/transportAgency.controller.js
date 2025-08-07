const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../../helpers/upload");
const TransportAgency = require("../../models/transportAgency.model");
const TransportAgencyImage = require("../../models/transportAgencyImages.model");
const TransportType = require("../../models/transportType.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, agencyId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "transport-agency", agencyId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    transportAgencyId: agencyId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* Create transport agency with images and transport types */
exports.createTransportAgency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { transportTypes, ...agencyData } = req.body;

    // Generate slug if not provided
    if (!agencyData.slug && agencyData.title) {
      agencyData.slug = slugify(agencyData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const agency = await TransportAgency.create(agencyData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, agency.id);
    if (images.length > 0) {
      await TransportAgencyImage.bulkCreate(images);
    }

    // Add transport types if provided
    if (transportTypes?.length) {
      await agency.addTransportTypes(transportTypes);
    }

    // Fetch with associations
    const agencyWithAssociations = await TransportAgency.findByPk(agency.id, {
      include: [
        {
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Transport agency created successfully",
      data: agencyWithAssociations,
    });
  } catch (error) {
    console.error("Error creating transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transport agency",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all transport agencies */
exports.getAllTransportAgencies = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      includeDeleted,
      page = 1,
      limit = 10,
      search,
      city,
      district,
      province,
    } = req.query;

    const where = {};
    const include = [
      {
        model: TransportType,
        as: "transportTypes",
        through: { attributes: [] },
        attributes: ["id", "name"],
      },
      {
        model: TransportAgencyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl"],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (city) where.city = city;
    if (district) where.district = district;
    if (province) where.province = province;

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { serviceArea: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
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

    const { count, rows: agencies } = await TransportAgency.findAndCountAll(
      options
    );

    return res.status(200).json({
      success: true,
      data: agencies,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transport agencies:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport agencies",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get transport agency by ID */
exports.getTransportAgencyById = async (req, res) => {
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
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl"],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const agency = await TransportAgency.findOne(options);

    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: agency,
    });
  } catch (error) {
    console.error("Error fetching transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport agency",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport agency with precise image control */
exports.updateTransportAgency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findByPk(req.params.id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    const {
      transportTypes,
      images: imageUpdates = [],
      ...updateData    
    } = req.body;

    // Update slug if title changed
    if (
      updateData.title &&
      !updateData.slug &&
      updateData.title !== agency.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update transport types if provided
    if (transportTypes) {
      await agency.updateTransportTypes(transportTypes);
    }

    // Handle image updates if provided
    if (Array.isArray(imageUpdates)) {
      // Get current images from database
      const currentImages = await agency.getImages();

      // Separate images into different operations
      const imagesToKeep = imageUpdates.filter((img) => img.id); // Existing images to keep/update
      const imagesToAdd = imageUpdates.filter((img) => !img.id); // New images to add
      const imagesToDelete = currentImages.filter(
        (dbImage) =>
          !imageUpdates.some((updateImg) => updateImg.id === dbImage.id)
      );

      // 1. Delete images that were removed (from DB and S3)
      if (imagesToDelete.length > 0) {
        const s3KeysToDelete = imagesToDelete
          .map((img) => img.s3Key)
          .filter((key) => key);

        if (s3KeysToDelete.length > 0) {
          await UploadService.deleteMultipleFiles(s3KeysToDelete);
        }

        await TransportAgencyImage.destroy({
          where: { id: imagesToDelete.map((img) => img.id) },
          force: true,
        });
      }

      // 2. Update existing images (metadata changes)
      await agency.updateImages(imagesToKeep);

      // 3. Add new images (file uploads + DB records)
      const uploadedImages = await handleImageUploads(req.files, agency.id);
      const allNewImages = [...imagesToAdd, ...uploadedImages];

      if (allNewImages.length > 0) {
        await agency.addImages(allNewImages);
      }
    }

    // Update agency data
    await agency.update(updateData);

    // Fetch updated agency with associations
    const updatedAgency = await TransportAgency.findByPk(agency.id, {
      include: [
        {
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "caption", "isFeatured", "sortOrder"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport agency updated successfully",
      data: updatedAgency,
    });
  } catch (error) {
    console.error("Error updating transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport agency",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport agency */
exports.deleteTransportAgency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findByPk(req.params.id, {
      include: [{ model: TransportAgencyImage, as: "images" }],
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = agency.images.map((img) => img.s3Key).filter((key) => key); // Filter out null/undefined keys

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await agency.destroy();

    return res.status(200).json({
      success: true,
      message: "Transport agency deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport agency",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore soft-deleted transport agency */
exports.restoreTransportAgency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found (including soft-deleted)",
      });
    }

    if (!agency.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport agency is not deleted",
      });
    }

    await agency.restore();

    const restoredAgency = await TransportAgency.findByPk(req.params.id, {
      include: [
        {
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport agency restored successfully",
      data: restoredAgency,
    });
  } catch (error) {
    console.error("Error restoring transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore transport agency",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle transport agency active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.scope("withInactive").findByPk(req.params.id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    await agency.toggleVisibility();

    return res.status(200).json({
      success: true,
      message: "Transport agency status toggled successfully",
      data: {
        id: agency.id,
        isActive: !agency.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling transport agency status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle transport agency status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Verify transport agency */
exports.verifyTransportAgency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findByPk(req.params.id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !agency.vistaVerified;

    await agency.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Transport agency verification status updated",
      data: {
        id: agency.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying transport agency:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport agency transport types */
exports.updateTransportTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findByPk(req.params.id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    const { transportTypes } = req.body;

    await agency.updateTransportTypes(transportTypes);

    const updatedAgency = await TransportAgency.findByPk(agency.id, {
      include: [
        {
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport agency types updated successfully",
      data: updatedAgency,
    });
  } catch (error) {
    console.error("Error updating transport agency types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport agency types",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport agency images */
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const agency = await TransportAgency.findByPk(req.params.id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Transport agency not found",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, agency.id);

    if (images.length > 0) {
      await TransportAgencyImage.destroy({
        where: { transportAgencyId: agency.id },
      });
      await TransportAgencyImage.bulkCreate(images);
    }

    const updatedAgency = await TransportAgency.findByPk(agency.id, {
      include: [
        {
          model: TransportType,
          as: "transportTypes",
          through: { attributes: [] },
        },
        {
          model: TransportAgencyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport agency images updated successfully",
      data: updatedAgency,
    });
  } catch (error) {
    console.error("Error updating transport agency images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport agency images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport agency image */
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const image = await TransportAgencyImage.findOne({
      where: {
        id: req.params.imageId,
        transportAgencyId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this transport agency",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Transport agency image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport agency image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport agency image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Set featured image */
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // First unset any currently featured image
    await TransportAgencyImage.update(
      { isFeatured: false },
      {
        where: {
          transportAgencyId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await TransportAgencyImage.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          transportAgencyId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this transport agency",
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
