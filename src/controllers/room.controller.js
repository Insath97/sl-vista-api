const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const UploadService = require("../helpers/upload");
const Room = require("../models/room.model");
const RoomImage = require("../models/roomImage.model");
const Amenity = require("../models/amenity.model");
const RoomAmenity = require("../models/roomAmenity.model");
const Property = require("../models/property.model");
const RoomType = require("../models/roomType.model");
const User = require("../models/user.model");
const MerchantProfile = require("../models/merchantProfile.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, roomId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "rooms", roomId)
  );v

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    roomId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* Create room with images and amenities */
exports.createRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    /*  const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    // Verify property ownership for merchants
    if (user.accountType === "merchant") {
      const property = await Property.findOne({
        where: {
          id: req.body.propertyId,
          merchantId: user.merchantProfile.id,
        },
      });

      if (!property) {
        return res.status(403).json({
          success: false,
          message: "Property not found or not owned by merchant",
        });
      }
    } */

    const { amenities, ...roomData } = req.body;

    const room = await Room.create(roomData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, room.id);
    if (images.length > 0) {
      await RoomImage.bulkCreate(images);
    }

    // Add amenities if provided
    if (amenities?.length) {
      await room.addAmenities(amenities);
    }

    // Fetch with associations
    const roomWithAssociations = await Room.findByPk(room.id, {
      include: [
        {
          model: Property,
          as: "property",
        },
        {
          model: RoomType,
          as: "roomType",
        },
        {
          model: Amenity,
          as: "amenities",
        },
        {
          model: RoomImage,
          as: "images",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: roomWithAssociations,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create room",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all rooms */
exports.getAllRooms = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      includeInactive,
      includeDeleted,
      includeImages,
      includeAmenities,
      includeProperty,
      page = 1,
      limit = 10,
      search,
      propertyId,
      roomTypeId,
      minPrice,
      maxPrice,
      approvalStatus,
      availabilityStatus,
    } = req.query;

    const where = {};
    const include = [];

    // For merchants, only show rooms from their properties
    if (req.user.accountType === "merchant") {
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: MerchantProfile,
            as: "merchantProfile",
            attributes: ["id", "businessName"], // Only include needed merchant fields
          },
        ],
      });

      if (!user || !user.merchantProfile) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      include.push({
        model: Property,
        as: "property",
        where: { merchantId: user.merchantProfile.id },
        attributes: ["id", "title"], // Only include needed property fields
      });
    }

    if (includeProperty === "true") {
      include.push({
        model: Property,
        as: "property",
        attributes: ["id", "title", "merchantId"], // Only essential property fields
        include: [
          {
            model: MerchantProfile,
            as: "merchant",
            attributes: ["id", "businessName"], // Only merchant ID and business name
          },
        ],
      });
    }

    if (includeAmenities === "true") {
      include.push({
        model: Amenity,
        as: "amenities",
        attributes: ["id", "name"], // Only amenity ID and name
        through: { attributes: [] }, // Exclude join table attributes
      });
    }

    if (includeImages === "true") {
      include.push({
        model: RoomImage,
        as: "images",
        attributes: ["id", "roomId", "imageUrl"], // Only essential image fields
      });
    }

    // Filter conditions
    if (includeInactive !== "true") where.isActive = true;
    if (propertyId) where.propertyId = propertyId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (minPrice) where.basePrice = { [Op.gte]: parseFloat(minPrice) };
    if (maxPrice) {
      where.basePrice = {
        ...where.basePrice,
        [Op.lte]: parseFloat(maxPrice),
      };
    }
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;

    if (search) {
      where[Op.or] = [
        { roomNumber: { [Op.like]: `%${search}%` } },
        { floor: { [Op.like]: `%${search}%` } },
        { bedConfiguration: { [Op.like]: `%${search}%` } },
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

    const { count, rows: rooms } = await Room.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: rooms,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get room by ID */
exports.getRoomById = async (req, res) => {
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
          model: Property,
          as: "property",
          include: [
            {
              model: MerchantProfile,
              as: "merchant",
              attributes: ["id", "businessName"],
            },
          ],
        },
        {
          model: RoomType,
          as: "roomType",
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    // For merchants, verify ownership
    if (req.user.accountType === "merchant") {
      const user = await User.findByPk(req.user.id, {
        include: [{ model: MerchantProfile, as: "merchantProfile" }],
      });

      if (!user || !user.merchantProfile) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      options.include[0].where = { merchantId: user.merchantProfile.id };
    }

    const room = await Room.findOne(options);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update room */
exports.updateRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, room.id);
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

    // Update amenities if provided
    if (amenities) {
      await room.updateAmenities(amenities);
    }

    // Update images if provided
    if (newImages.length > 0) {
      await RoomImage.destroy({
        where: { roomId: room.id },
      });
      await RoomImage.bulkCreate(newImages);
    }

    await room.update(updateData);

    // Fetch updated room
    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: Property,
          as: "property",
        },
        {
          model: RoomType,
          as: "roomType",
        },
        {
          model: Amenity,
          as: "amenities",
        },
        {
          model: RoomImage,
          as: "images",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete room */
exports.deleteRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
        {
          model: RoomImage,
          as: "images",
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    // Get all S3 keys from images
    const s3Keys = room.images.map((img) => img.s3Key).filter(Boolean);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      await UploadService.deleteMultipleFiles(s3Keys);
    }

    await room.destroy();

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete room",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore room */
exports.restoreRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
      paranoid: false,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found (including soft-deleted)",
      });
    }

    if (!room.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Room is not deleted",
      });
    }

    await room.restore();

    const restoredRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: Property,
          as: "property",
        },
        {
          model: RoomType,
          as: "roomType",
        },
        {
          model: Amenity,
          as: "amenities",
        },
        {
          model: RoomImage,
          as: "images",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Room restored successfully",
      data: restoredRoom,
    });
  } catch (error) {
    console.error("Error restoring room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore room",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Admin update approval status */
exports.updateApprovalStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const room = await Room.findByPk(req.params.id, {
      include: [
        {
          model: Property,
          as: "property",
          include: [
            {
              model: MerchantProfile,
              as: "merchant",
            },
          ],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const { approvalStatus, rejectionReason } = req.body;

    const updateData = {
      approvalStatus,
      ...(approvalStatus === "approved" && {
        approvedAt: new Date(),
        vistaVerified: true,
      }),
      ...(approvalStatus === "rejected" && { rejectionReason }),
    };

    await room.update(updateData);

    // Fetch updated room with associations
    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        { model: Property, as: "property" },
        { model: RoomType, as: "roomType" },
        { model: Amenity, as: "amenities" },
        { model: RoomImage, as: "images" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Room approval status updated",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating approval status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update approval status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle room active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    await room.update({ isActive: !room.isActive });

    return res.status(200).json({
      success: true,
      message: "Room status toggled successfully",
      data: {
        id: room.id,
        isActive: !room.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling room status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle room status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Vista verify room (admin only) */
exports.vistaVerifyRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Only update the vistaVerified field
    await room.update({
      vistaVerified: req.body.vistaVerified,
    });

    return res.status(200).json({
      success: true,
      message: "Room Vista verification updated",
      data: {
        id: room.id,
        vistaVerified: room.vistaVerified,
      },
    });
  } catch (error) {
    console.error("Error updating Vista verification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Vista verification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update room amenities */
exports.updateAmenities = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    const { amenities } = req.body;

    await room.updateAmenities(amenities);

    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Room amenities updated successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating room amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Admin approval for merchant-created rooms */
exports.approveRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { approvalStatus, rejectionReason } = req.body;
    const room = await Room.findByPk(req.params.id, {
      include: [
        {
          model: Property,
          as: "property",
          include: [
            {
              model: MerchantProfile,
              as: "merchant",
            },
          ],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Validate status transition
    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a room",
      });
    }

    const updateData = {
      approvalStatus,
      lastStatusChange: new Date(),
    };

    if (approvalStatus === "approved") {
      updateData.approvedAt = new Date();
      updateData.rejectionReason = null;
    } else if (approvalStatus === "rejected") {
      updateData.rejectionReason = rejectionReason;
    }

    await room.update(updateData);

    return res.status(200).json({
      success: true,
      message: `Room ${approvalStatus} successfully`,
      data: {
        id: room.id,
        approvalStatus: room.approvalStatus,
        approvedAt: room.approvedAt,
        rejectionReason: room.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Error updating room approval:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room approval",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete room amenities */
exports.deleteAmenities = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    const { amenityIds } = req.body;

    if (!Array.isArray(amenityIds)) {
      return res.status(400).json({
        success: false,
        message: "Amenity IDs must be provided as an array",
      });
    }

    await RoomAmenity.destroy({
      where: {
        roomId: room.id,
        amenityId: amenityIds,
      },
    });

    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Amenities deleted successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error deleting room amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update room images */
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, room.id);

    if (images.length > 0) {
      await RoomImage.destroy({
        where: { roomId: room.id },
      });
      await RoomImage.bulkCreate(images);
    }

    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: RoomImage,
          as: "images",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Room images updated successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating room images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete room image */
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or not owned by merchant",
      });
    }

    const image = await RoomImage.findOne({
      where: { id: req.params.imageId, roomId: room.id },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this room",
      });
    }

    // Delete from S3 if exists
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
