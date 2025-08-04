const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../../helpers/upload");
const LocalArtists = require("../../models/localArtists.model");
const LocalArtistImage = require("../../models/localArtistsImages.model");
const ArtistType = require("../../models/artistsType.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, artistId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "local-artists", artistId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    localArtistId: artistId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

// Create Local Artist
exports.createLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { artistTypes, ...artistData } = req.body;

    // Generate slug if not provided
    if (!artistData.slug && artistData.name) {
      artistData.slug = slugify(artistData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const artist = await LocalArtists.create(artistData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, artist.id);
    if (images.length > 0) {
      await artist.addImages(images);
    }

    // Add artist types if provided
    if (artistTypes?.length) {
      await artist.addArtistTypes(artistTypes);
    }

    // Fetch with associations
    const artistWithAssociations = await LocalArtists.findByPk(artist.id, {
      include: [
        {
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: LocalArtistImage,
          as: "images",
          attributes: ["id", "localArtistId", "imageUrl", "fileName"],
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Local artist created successfully",
      data: artistWithAssociations,
    });
  } catch (error) {
    console.error("Error creating local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create local artist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Local Artists
exports.getAllLocalArtists = async (req, res) => {
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
      includeTypes,
      page = 1,
      limit = 10,
      search,
      city,
      district,
      province,
      artistTypeId,
    } = req.query;

    const where = {};
    const include = [
      {
        model: ArtistType,
        as: "artistTypes",
        through: { attributes: [] },
        attributes: ["id", "name"],
      },
      {
        model: LocalArtistImage,
        as: "images",
        attributes: ["id", "localArtistId", "imageUrl", "fileName"],
        order: [["sortOrder", "ASC"]],
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
        { name: { [Op.like]: `%${search}%` } },
        { specialization: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (includeTypes === "true") {
      include.push({
        model: ArtistType,
        as: "artistTypes",
        through: { attributes: [] },
        ...(artistTypeId && { where: { id: artistTypeId } }),
      });
    }

    if (includeImages === "true") {
      include.push({
        model: LocalArtistImage,
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

    const { count, rows: artists } = await LocalArtists.findAndCountAll(
      options
    );

    return res.status(200).json({
      success: true,
      data: artists,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching local artists:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch local artists",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Local Artist by ID
exports.getLocalArtistById = async (req, res) => {
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
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: LocalArtistImage,
          as: "images",
          attributes: ["id", "localArtistId", "imageUrl", "fileName"],
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const artist = await LocalArtists.findOne(options);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: artist,
    });
  } catch (error) {
    console.error("Error fetching local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch local artist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Local Artist
exports.updateLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const { artistTypes, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, artist.id);
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
      updateData.name &&
      !updateData.slug &&
      updateData.name !== artist.name
    ) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update artist types if provided
    if (artistTypes) {
      await artist.updateArtistTypes(artistTypes);
    }

    // Update images
    if (newImages.length > 0) {
      await artist.updateImages(newImages);
    }

    await artist.update(updateData);

    // Fetch updated artist
    const updatedArtist = await LocalArtists.findByPk(artist.id, {
      include: [
        {
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
        },
        {
          model: LocalArtistImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Local artist updated successfully",
      data: updatedArtist,
    });
  } catch (error) {
    console.error("Error updating local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update local artist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Local Artist
exports.deleteLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtists.findByPk(req.params.id, {
      include: [{ model: LocalArtistImage, as: "images" }],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = artist.images.map((img) => img.s3Key).filter((key) => key);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await artist.destroy();

    return res.status(200).json({
      success: true,
      message: "Local artist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete local artist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Restore Local Artist
exports.restoreLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtists.findOne({
      where: { id: req.params.id },
      paranoid: false, // Important: include soft-deleted records
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found (including soft-deleted)",
      });
    }

    if (!artist.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Local artist is not deleted",
      });
    }

    await artist.restore();

    // Fetch the restored artist with associations
    const restoredArtist = await LocalArtists.findByPk(req.params.id, {
      include: [
        {
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
          attributes: ["id", "name"], // Only include needed fields
        },
        {
          model: LocalArtistImage,
          as: "images",
          attributes: ["id", "localArtistId", "imageUrl", "fileName"],
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: false, // Important: ensure we can find recently restored records
    });

    if (!restoredArtist) {
      return res.status(500).json({
        success: false,
        message: "Artist restored but could not be fetched",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Local artist restored successfully",
      data: restoredArtist,
    });
  } catch (error) {
    console.error("Error restoring local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore local artist",
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
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const newStatus = !artist.isActive;
    await artist.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Local artist status toggled successfully",
      data: {
        id: artist.id,
        isActive: newStatus,
      },
    });
  } catch (error) {
    console.error("Error toggling local artist status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle local artist status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify Local Artist
exports.verifyLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !artist.vistaVerified;

    await artist.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Local artist verification status updated",
      data: {
        id: artist.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying local artist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Artist Types
exports.updateArtistTypes = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const { artistTypes } = req.body;

    await artist.updateArtistTypes(artistTypes);

    const updatedArtist = await LocalArtists.findByPk(artist.id, {
      include: [
        {
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
        },
        {
          model: LocalArtistImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Local artist types updated successfully",
      data: updatedArtist,
    });
  } catch (error) {
    console.error("Error updating local artist types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update local artist types",
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
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, artist.id);

    if (images.length > 0) {
      await artist.updateImages(images);
    }

    const updatedArtist = await LocalArtists.findByPk(artist.id, {
      include: [
        {
          model: ArtistType,
          as: "artistTypes",
          through: { attributes: [] },
        },
        {
          model: LocalArtistImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Local artist images updated successfully",
      data: updatedArtist,
    });
  } catch (error) {
    console.error("Error updating local artist images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update local artist images",
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
    const image = await LocalArtistImage.findOne({
      where: {
        id: req.params.imageId,
        localArtistId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this local artist",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Local artist image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting local artist image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete local artist image",
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
    const artist = await LocalArtists.findByPk(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const featuredImage = await artist.setFeaturedImage(req.params.imageId);

    return res.status(200).json({
      success: true,
      message: "Featured image set successfully",
      data: featuredImage,
    });
  } catch (error) {
    console.error("Error setting featured image:", error);
    const isNotFound = error.message?.includes("not found");

    return res.status(isNotFound ? 404 : 500).json({
      success: false,
      message: isNotFound
        ? "Image not found for this local artist"
        : "Failed to set featured image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
