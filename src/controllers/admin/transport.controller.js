const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../../helpers/upload");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const Amenity = require("../../models/amenity.model");
const TransportImage = require("../../models/transportImage.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, transportId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "transport", transportId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    transportId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* Create transport with images and amenities */
exports.createTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amenities, ...transportData } = req.body;

    // Generate slug if not provided
    if (!transportData.slug && transportData.title) {
      transportData.slug = slugify(transportData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const transport = await Transport.create(transportData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, transport.id);
    if (images.length > 0) {
      await TransportImage.bulkCreate(images);
    }

    // Add amenities if provided
    if (amenities?.length) {
      await transport.addAmenities(amenities);
    }

    // Fetch with associations
    const transportWithAssociations = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
        { model: TransportImage, as: "images" },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Transport created successfully",
      data: transportWithAssociations,
    });
  } catch (error) {
    console.error("Error creating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all transports with optional images */
exports.getAllTransports = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      transportTypeId,
      departureCity,
      arrivalCity,
      minSeats,
      maxPrice,
      isActive,
      vistaVerified,
      includeDeleted,
      includeImages,
      page = 1,
      limit = 10,
      search,
      amenities,
    } = req.query;

    const where = {};
    const include = [
      { model: TransportType, as: "transportType" },
      {
        model: Amenity,
        as: "amenities",
        where: amenities ? { id: { [Op.in]: amenities.split(",") } } : {},
        required: !!amenities,
        through: { attributes: ["isAvailable", "notes"] },
      },
    ];

    // Conditionally include images
    if (includeImages === "true") {
      include.push({
        model: TransportImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      });
    }

    // Filter conditions
    if (transportTypeId) where.transportTypeId = transportTypeId;
    if (departureCity)
      where.departureCity = { [Op.iLike]: `%${departureCity}%` };
    if (arrivalCity) where.arrivalCity = { [Op.iLike]: `%${arrivalCity}%` };
    if (minSeats) where.seatCount = { [Op.gte]: minSeats };
    if (maxPrice) where.pricePerKmUSD = { [Op.lte]: maxPrice };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { operatorName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
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

    const { count, rows: transports } = await Transport.findAndCountAll(
      options
    );

    return res.status(200).json({
      success: true,
      data: transports,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
    });
  }
};

/* Get transport by ID with images */
exports.getTransportById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const options = {
      where: { id: req.params.id },
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
        {
          model: TransportImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const transport = await Transport.findOne(options);

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error("Error fetching transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport",
    });
  }
};

/* Update transport with optional images */
exports.updateTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, transport.id);
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
      updateData.title !== transport.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update amenities
    if (amenities) {
      await transport.setAmenities(amenities);
    }

    // Update images
    if (newImages.length > 0) {
      await TransportImage.destroy({ where: { transportId: transport.id } });
      await TransportImage.bulkCreate(newImages);
    }

    await transport.update(updateData);

    // Fetch updated transport
    const updatedTransport = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
        { model: TransportImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport (images are cascade deleted) */
exports.deleteTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id, {
      include: [{ model: TransportImage, as: "images" }],
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    // Delete all associated images from S3
    const s3Images = transport.images.filter((img) => img.s3Key);
    const deletePromises = s3Images.map((img) =>
      uploadService.deleteFile(img.s3Key)
    );

    await Promise.all(deletePromises);
    await transport.destroy();

    return res.status(200).json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport",
    });
  }
};
/* Restore soft-deleted transport with images */
exports.restoreTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found (including soft-deleted)",
      });
    }

    if (!transport.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport is not deleted",
      });
    }

    await transport.restore();

    const restoredTransport = await Transport.findByPk(req.params.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
        { model: TransportImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport restored successfully",
      data: restoredTransport,
    });
  } catch (error) {
    console.error("Error restoring transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle transport active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    await transport.update({ isActive: !transport.isActive });

    return res.status(200).json({
      success: true,
      message: "Transport status toggled successfully",
      data: {
        id: transport.id,
        isActive: !transport.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling transport status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle transport status",
    });
  }
};

/* Verify transport */
exports.verifyTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    // Toggle verification status or set based on request body
    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !transport.vistaVerified;

    await transport.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Transport verification status updated",
      data: {
        id: transport.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport amenities */
exports.updateTransportAmenities = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    const { amenities } = req.body;

    // Clear existing amenities if empty array is provided
    if (Array.isArray(amenities)) {
      if (amenities.length === 0) {
        await transport.setAmenities([]);
      } else {
        // Update amenities with their specific attributes
        await Promise.all(
          amenities.map(async (amenity) => {
            await transport.sequelize.models.TransportAmenity.upsert({
              transportId: transport.id,
              amenityId: amenity.amenityId,
              isAvailable:
                amenity.isAvailable !== undefined ? amenity.isAvailable : true,
              notes: amenity.notes || null,
            });
          })
        );
      }
    }

    // Fetch the updated transport with all associations
    const updatedTransport = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        { model: TransportImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport amenities updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport images only */
exports.updateTransportImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, transport.id);

    if (images.length > 0) {
      await TransportImage.destroy({ where: { transportId: transport.id } });
      await TransportImage.bulkCreate(images);
    }

    const updatedTransport = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
        { model: TransportImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport images updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport image */
exports.deleteTransportImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const image = await TransportImage.findOne({
      where: {
        id: req.params.imageId,
        transportId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this transport",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await uploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Transport image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport image",
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
    await TransportImage.update(
      { isFeatured: false },
      {
        where: {
          transportId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await TransportImage.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          transportId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this transport",
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
