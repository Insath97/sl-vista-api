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
  );

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

// Helper to check business type access
const checkBusinessTypeAccess = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: MerchantProfile,
        as: "merchantProfile",
        attributes: ["id", "businessType"],
      },
    ],
  });

  if (
    user?.accountType === "merchant" &&
    user?.merchantProfile?.businessType === "homestay"
  ) {
    throw new Error("Your business type does not allow room management");
  }
};

/* Create room with images and amenities */
exports.createRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    await checkBusinessTypeAccess(req.user.id);

    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchantProfile",
          where: {
            isActive: true,
            status: "active",
          },
          required: false,
        },
      ],
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User not found",
      });
    }

    const { amenities, ...roomData } = req.body;

    if (req.user.accountType === "merchant") {
      const property = await Property.findOne({
        where: {
          id: roomData.propertyId,
          merchantId: req.user.merchantProfile.id,
        },
      });
      if (!property) {
        return res.status(403).json({
          success: false,
          message: "Property not found or not owned by merchant",
        });
      }
    }

    // Set approval status
    roomData.approvalStatus =
      req.user.accountType === "admin" ? "approved" : "pending";
    if (req.user.accountType === "admin") {
      roomData.approvedAt = new Date();
    }

    const room = await Room.create(roomData);

    const images = await handleImageUploads(req.files, room.id);
    if (images.length > 0) {
      await RoomImage.bulkCreate(images);
    }

    if (amenities?.length) {
      await room.addAmenities(amenities);
    }

    const roomWithAssociations = await Room.findByPk(room.id, {
      include: [
        {
          model: RoomType,
          as: "roomType",
          attributes: ["id", "name"],
        },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
          /* required: false */
        },
        {
          model: RoomImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title"],
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
      isActive,
      vistaVerified,
      includeDeleted,
      search,
      propertyId,
      roomTypeId,
      minPrice,
      maxPrice,
      approvalStatus,
      availabilityStatus,
      page = 1,
      limit = 10,
    } = req.query;

    const where = {};
    const include = [
      {
        model: RoomType,
        as: "roomType",
        attributes: ["id", "name"],
      },
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: [] },
        attributes: ["id", "name"],
        /* required: false */
      },
      {
        model: RoomImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl", "fileName"],
      },
      {
        model: Property,
        as: "property",
        attributes: ["id", "title"],
      },
    ];

    if (propertyId) where.propertyId = propertyId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (minPrice) where.basePrice = { [Op.gte]: parseFloat(minPrice) };
    if (maxPrice) {
      where.basePrice = {
        ...where.basePrice,
        [Op.lte]: parseFloat(maxPrice),
      };
    }

    if (search) {
      where[Op.or] = [
        { roomNumber: { [Op.like]: `%${search}%` } },
        { floor: { [Op.like]: `%${search}%` } },
        { bedConfiguration: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (vistaVerified !== undefined) {
      where.vistaVerified = vistaVerified === "true";
    }

    if (req.user) {
      await checkBusinessTypeAccess(req.user.id);
      if (req.user.accountType === "merchant") {
        const merchant = await MerchantProfile.findOne({
          where: { userId: req.user.id },
        });

        if (!merchant) {
          return res.status(403).json({
            success: false,
            message: "Merchant profile not found",
          });
        }

        include.push({
          model: Property,
          as: "property",
          where: { merchantId: merchant.id },
          attributes: [],
          required: true,
        });
      }
    } else {
      where.isActive = true;
      where.approvalStatus = "approved";
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
    const roomId = req.params.id; // Get the ID from params

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }

    const where = { id: roomId }; // Use the specific ID
    const include = [
      {
        model: RoomType,
        as: "roomType",
        attributes: ["id", "name"],
      },
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: [] },
        attributes: ["id", "name"],
        required: false,
      },
      {
        model: RoomImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl", "fileName"],
        required: false,
      },
      {
        model: Property,
        as: "property",
        attributes: ["id", "title"],
        required: false,
      },
    ];

    // For authenticated users
    if (req.user) {
      await checkBusinessTypeAccess(req.user.id);

      if (req.user.accountType === "merchant") {
        const merchant = await MerchantProfile.findOne({
          where: { userId: req.user.id },
        });

        if (!merchant) {
          return res.status(403).json({
            success: false,
            message: "Merchant profile not found",
          });
        }

        // Add merchant-specific property filter
        include.push({
          model: Property,
          as: "property",
          where: { merchantId: merchant.id },
          attributes: [],
          required: true,
        });
      }
    }
    // For public access
    else {
      where.isActive = true;
      where.approvalStatus = "approved";
    }

    const options = {
      where,
      include,
      paranoid: includeDeleted === "true" ? false : true,
    };

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
    await checkBusinessTypeAccess(req.user.id);

    // Fetch room with all necessary associations
    const room = await Room.findByPk(req.params.id, {
      include: [
        {
          model: RoomType,
          as: "roomType",
          attributes: ["id", "name"],
        },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: RoomImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName", "s3Key"], // Added s3Key here
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "merchantId"], // Added merchantId here
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Merchant permission check
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || room.property.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update this room",
        });
      }
    }

    // Admin permission check for approval status
    if (req.user.accountType !== "admin" && "approvalStatus" in updateData) {
      return res.status(403).json({
        success: false,
        message: "Only admins can change approval status",
      });
    }

    // Set approval status
    updateData.approvalStatus =
      req.user.accountType === "admin" ? "approved" : "pending";
    if (req.user.accountType === "admin") {
      updateData.approvedAt = new Date();
    }

    // Update basic room data
    await room.update(updateData);

    // Update amenities if provided
    if (amenities) {
      await room.updateAmenities(amenities);
    }

    // Handle image uploads
    const uploadedImages = await handleImageUploads(req.files, room.id);
    newImages = [...uploadedImages];

    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          roomId: room.id,
        })),
      ];
    }

    // CORRECTED: Use room.images instead of property.images
    const existingImageKeys = room.images
      .map((img) => img.s3Key)
      .filter((key) => key);

    // Delete old images from S3
    if (existingImageKeys.length > 0) {
      try {
        await UploadService.deleteMultipleFiles(existingImageKeys);
      } catch (error) {
        console.error("Error deleting old images from S3:", error);
      }
    }

    // Update images in database
    if (newImages.length > 0) {
      await RoomImage.destroy({
        where: { roomId: room.id },
        force: true,
      });
      await RoomImage.bulkCreate(newImages);
    }

    // Fetch updated room with all associations
    const updatedRoom = await Room.findByPk(room.id, {
      include: [
        {
          model: RoomType,
          as: "roomType",
          attributes: ["id", "name"],
        },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: RoomImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title"],
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
  try {
    const { id } = req.params;

    await checkBusinessTypeAccess(req.user.id);

    const room = await Room.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Property,
          as: "property",
          attributes: ["id", "merchantId"],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || room.property.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to delete this room",
        });
      }
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
  try {
    const { id } = req.params;

    await checkBusinessTypeAccess(req.user.id);

    const room = await Room.findOne({
      where: { id },
      include: [
        {
          model: RoomType,
          as: "roomType",
          attributes: ["id", "name"],
        },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: RoomImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName", "s3Key"], // Added s3Key here
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "merchantId"], // Added merchantId here
        },
      ],
      paranoid: false,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || room.property.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to restore this room",
        });
      }
    }

    if (room.deletedAt === null) {
      return res.status(400).json({
        success: false,
        message: "Room is not deleted",
      });
    }

    await room.restore();

    return res.status(200).json({
      success: true,
      message: "Room restored successfully",
      data: room,
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

/* Vista Verification */
exports.vistaVerification = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update verification status",
      });
    }

    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined ? req.body.verified : !room.vistaVerified;

    await room.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      data: {
        id: room.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error updating verification status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update Active Status */
exports.updateRoomStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update room status",
      });
    }

    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Determine new status (toggle if not specified)
    const newActiveStatus =
      req.body.isActive !== undefined ? req.body.isActive : !room.isActive;

    await room.update({
      isActive: newActiveStatus,
      availabilityStatus: newActiveStatus ? "available" : "unavailable",
    });

    return res.status(200).json({
      success: true,
      message: "Room status updated successfully",
      data: {
        id: room.id,
        isActive: newActiveStatus,
        availabilityStatus: newActiveStatus ? "available" : "unavailable",
      },
    });
  } catch (error) {
    console.error("Error updating room status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update Room Availability Status */
exports.updateAvailabilityStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { availabilityStatus } = req.body;

    await checkBusinessTypeAccess(req.user.id);

    // Find room with property info
    const room = await Room.findByPk(id, {
      include: [
        {
          model: Property,
          as: "property",
          attributes: ["id", "merchantId"],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || room.property.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You can only update availability for your own rooms",
        });
      }
    }

    // Validate status (should already be handled by validation middleware)
    const validStatuses = [
      "available",
      "unavailable",
      "maintenance",
      "archived",
    ];
    if (!validStatuses.includes(availabilityStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability status",
      });
    }

    // Update the status
    await room.update({ availabilityStatus });

    return res.status(200).json({
      success: true,
      message: "Availability status updated successfully",
      data: {
        id: room.id,
        availabilityStatus: room.availabilityStatus,
      },
    });
  } catch (error) {
    console.error("Error updating availability status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update availability status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update Room Approval Status (Admin Only) */
exports.updateApprovalStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Verify admin access
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update approval status",
      });
    }

    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    const room = await Room.findByPk(id, {
      paranoid: false,
      include: [
        {
          model: Property,
          as: "property",
          attributes: ["id", "title"],
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

    // Prepare update data
    const updateData = {
      approvalStatus,
      lastStatusChange: new Date(),
    };

    // Handle special cases
    if (approvalStatus === "approved") {
      updateData.approvedAt = new Date();
      updateData.vistaVerified = true;
      updateData.rejectionReason = null;
    } else if (approvalStatus === "rejected") {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus === "changes_requested") {
      updateData.rejectionReason =
        rejectionReason || "Changes requested by admin";
    }

    // Update room
    await room.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Room approval status updated successfully",
      data: {
        id: room.id,
        approvalStatus: room.approvalStatus,
        rejectionReason: room.rejectionReason,
        approvedAt: room.approvedAt,
        property: room.property,
      },
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


/* #################################################################################################################################### */

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
