const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../../helpers/upload");
const LocalArtistType = require("../../models/localArtistType.model");
const LocalArtist = require("../../models/localArtist.model");
const LocalArtistImage = require("../../models/localArtistImage.model");

// Helper function for image uploads
const handleImageUploads = async (files, artistId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "artists", artistId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    artistId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* create */
exports.createLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const {  ...artistData } = req.body;

    if (!artistData.slug && artistData.title) {
      artistData.slug = slugify(artistData.title, {
        lower: true,
        strict: true,
      });
    }

    const artist = await LocalArtist.create(artistData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, artist.id);
    if (images.length > 0) {
      await LocalArtistImage.bulkCreate(images);
    }

    const artistWithAssociations = await LocalArtist.findByPk(artist.id, {
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
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

/* get all */
exports.getAllLocalArtists = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      artistTypeId,
      language_code,
      province,
      district,
      city,
      isActive,
      includeDeleted,
      page = 1,
      limit = 10,
      search,
    } = req.query;

    const where = {};
    if (artistTypeId) where.artistTypeId = artistTypeId;
    if (language_code) where.language_code = language_code;
    if (province) where.province = { [Op.iLike]: `%${province}%` };
    if (district) where.district = { [Op.iLike]: `%${district}%` };
    if (city) where.city = { [Op.iLike]: `%${city}%` };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { specialization: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
    };

    const { count, rows: artists } = await LocalArtist.findAndCountAll(options);

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
    });
  }
};

/* get by id */
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
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
      ],
      paranoid: includeDeleted !== "true",
    };

    const artist = await LocalArtist.findOne(options);

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
    });
  }
};

/* update */
exports.updateLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtist.findByPk(req.params.id, {
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
      ],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    const updateData = req.body;

    // Update slug if title changed
    if (
      updateData.title &&
      !updateData.slug &&
      updateData.title !== artist.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Handle image uploads if files are present
    if (req.files?.images) {
      const images = await handleImageUploads(req.files, artist.id);
      if (images.length > 0) {
        // Delete existing images
        await LocalArtistImage.destroy({ where: { artistId: artist.id } });
        await LocalArtistImage.bulkCreate(images);
      }
    }

    await artist.update(updateData);

    const updatedArtist = await LocalArtist.findByPk(artist.id, {
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
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

/* delete */
exports.deleteLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtist.findByPk(req.params.id, {
      include: [{ model: LocalArtistImage, as: "images" }],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    // Delete associated images from storage
    const s3Images = artist.images.filter((img) => img.s3Key);
    await Promise.all(
      s3Images.map((img) => UploadService.deleteFile(img.s3Key))
    );

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

/* restore */
exports.restoreLocalArtist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtist.findOne({
      where: { id: req.params.id },
      paranoid: false,
      include: [{ model: LocalArtistImage, as: "images" }],
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

    const restoredArtist = await LocalArtist.findByPk(artist.id, {
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
      ],
    });

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

/* toggle status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtist.findByPk(req.params.id, {
      include: [{ model: LocalArtistImage, as: "images" }],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    await artist.update({ isActive: !artist.isActive });

    return res.status(200).json({
      success: true,
      message: "Local artist status toggled successfully",
      data: {
        id: artist.id,
        isActive: !artist.isActive,
        images: artist.images, // Include images in response
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

/* Update artist images */
exports.updateLocalArtistImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const artist = await LocalArtist.findByPk(req.params.id, {
      include: [{ model: LocalArtistImage, as: "images" }],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Local artist not found",
      });
    }

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, artist.id);
    let newImages = [...uploadedImages];

    // Handle body images if provided
    if (req.body.images?.length) {
      newImages = [
        ...newImages,
        ...req.body.images.map((img) => ({
          ...img,
          artistId: artist.id,
          s3Key: img.s3Key || null,
        })),
      ];
    }

    // Delete existing images if we have new ones
    if (newImages.length > 0) {
      // Delete from S3 first
      const s3Images = artist.images.filter((img) => img.s3Key);
      await Promise.all(
        s3Images.map((img) => UploadService.deleteFile(img.s3Key))
      );

      await LocalArtistImage.destroy({ where: { artistId: artist.id } });
      await LocalArtistImage.bulkCreate(newImages);
    }

    const updatedArtist = await LocalArtist.findByPk(artist.id, {
      include: [
        { model: LocalArtistType, as: "artistType" },
        { model: LocalArtistImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Artist images updated successfully",
      data: updatedArtist,
    });
  } catch (error) {
    console.error("Error updating artist images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update artist images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete artist image */
exports.deleteLocalArtistImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const image = await LocalArtistImage.findOne({
      where: {
        id: req.params.imageId,
        artistId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this artist",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Artist image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting artist image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete artist image",
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
    await LocalArtistImage.update(
      { isFeatured: false },
      {
        where: {
          artistId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await LocalArtistImage.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          artistId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this artist",
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
