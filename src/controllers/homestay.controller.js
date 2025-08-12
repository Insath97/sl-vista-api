const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../helpers/upload");
const HomeStay = require("../models/homeStay.model");
const Amenity = require("../models/amenity.model");
const User = require("../models/user.model");
const MerchantProfile = require("../models/merchantProfile.model");
const HomeStayImage = require("../models/homestayImage.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, homestayId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "homestay", homestayId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    homestayId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* create  */
exports.createHomestay = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get user with merchant profile
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

    const { amenities, ...homestayData } = req.body;
    let merchantId;

    // Generate slug if not provided
    if (!homestayData.slug && homestayData.title) {
      homestayData.slug = slugify(homestayData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Admin flow
    if (req.user.accountType === "admin") {
      if (!homestayData.merchantId) {
        return res.status(400).json({
          success: false,
          message: "merchantId is required for admin property creation",
        });
      }

      merchantId = homestayData.merchantId;

      // Verify merchant exists and is active
      const merchantExists = await MerchantProfile.findOne({
        where: {
          id: merchantId,
          isActive: true,
          status: "active",
        },
      });

      if (!merchantExists) {
        return res.status(400).json({
          success: false,
          message: "Specified merchant profile not found or not active",
        });
      }

      // Check property limit
      const homeStayCount = await HomeStay.count({
        where: { merchantId },
      });

      if (homeStayCount >= merchantExists.maxPropertiesAllowed) {
        return res.status(400).json({
          success: false,
          message: `Merchant has reached maximum allowed properties (${merchantExists.maxPropertiesAllowed})`,
        });
      }
    } else {
      if (!user.merchantProfile) {
        return res.status(403).json({
          success: false,
          message: "Active merchant profile not found or not approved",
        });
      }

      merchantId = user.merchantProfile.id;

      const homeStayCount = await HomeStay.count({
        where: { merchantId },
      });

      if (homeStayCount >= user.merchantProfile.maxPropertiesAllowed) {
        return res.status(400).json({
          success: false,
          message: `You have reached your maximum allowed properties (${user.merchantProfile.maxPropertiesAllowed})`,
        });
      }
    }

    // Set approval status
    homestayData.approvalStatus =
      user.accountType === "admin" ? "approved" : "pending";
    homestayData.merchantId = merchantId;

    if (user.accountType === "admin") {
      homestayData.approvedAt = new Date();
    }

    const homeStay = await HomeStay.create(homestayData);

    const images = await handleImageUploads(req.files, homeStay.id);
    if (images.length > 0) {
      await HomeStayImage.bulkCreate(images);
    }

    // Add amenities if provided
    if (amenities?.length) {
      await homeStay.addAmenities(amenities);
    }

    // Return the created homestay with associations
    const homestayWithAssociations = await HomeStay.findByPk(homeStay.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Homestay created successfully",
      data: homestayWithAssociations,
    });
  } catch (error) {
    console.error("Error creating homestay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get all */
exports.getAllHomeStays = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      search,
      city,
      district,
      province,
      includeDeleted,
      unitType,
      approvalStatus,
      availabilityStatus,
      merchantId,
      page = 1,
      limit = 10,
    } = req.body;

    const where = {};
    const include = [
      {
        model: HomeStayImage,
        as: "images",
        attributes: ["id", "imageUrl", "fileName"],
        order: [["sortOrder", "ASC"]],
      },
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: [] },
        attributes: ["id", "name"],
      },
    ];

    if (unitType) where.unitType = unitType;
    if (city) where.city = city;
    if (district) where.district = district;
    if (province) where.province = province;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (merchantId) where.merchantId = merchantId;

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (vistaVerified !== undefined) {
      where.vistaVerified = vistaVerified === "true";
    }

    // Search functionality
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (req.user) {
      console.log("Account type is : " + req.user.accountType);

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
        where.merchantId = merchant.id;
      }
    } else {
      where.isActive = true;
      where.approvalStatus = "approved";
    }

    const options = {
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
      distinct: true,
    };

    const { count, rows: homestays } = await HomeStay.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: homestays,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching homestays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestays",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get by id */
exports.getHomeStayById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const where = { id: req.params.id };
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: [] },
        attributes: ["id", "name"],
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl", "fileName"],
      },
    ];

    // Handle user-specific filtering
    if (req.user) {
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
        where.merchantId = merchant.id;
      }
    } else {
      where.isActive = true;
      where.approvalStatus = "approved";
    }

    const options = {
      where,
      include,
      paranoid: includeDeleted !== "true",
    };

    const homestay = await HomeStay.findOne(options);

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: homestay,
    });
  } catch (error) {
    console.error("Error fetching homestay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* update */
exports.updateHomeStay = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const homestay = await HomeStay.findByPk(req.params.id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
        {
          model: HomeStayImage,
          as: "images",
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || homestay.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update this homestay",
        });
      }
    }

    // Admins can change approval status, merchants can't
    if (req.user.accountType !== "admin" && "approvalStatus" in updateData) {
      return res.status(403).json({
        success: false,
        message: "Only admins can change approval status",
      });
    }

    if (
      updateData.merchantId &&
      updateData.merchantId != homestay.merchant.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot change homestay ownership",
      });
    }

    // Generate slug if title changed
    if (updateData.title && !updateData.slug) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    await homestay.update(updateData);

    if (amenities) {
      await homestay.updateAmenities(amenities);
    }

    const uploadedImages = await handleImageUploads(req.files, homestay.id);
    newImages = [...uploadedImages];

    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          homestayId: homestay.id,
        })),
      ];
    }

    const existingImageKeys = homestay.images
      .map((img) => img.s3Key)
      .filter((key) => key);

    if (existingImageKeys.length > 0) {
      try {
        if (existingImageKeys.length === 1) {
          await UploadService.deleteFile(existingImageKeys[0]);
        } else {
          await UploadService.deleteMultipleFiles(existingImageKeys);
        }
      } catch (error) {
        console.error("Error deleting old images from S3:", error);
      }
    }

    if (newImages.length > 0) {
      await HomeStayImage.destroy({
        where: { homestayId: homestay.id },
        force: true,
      });
      await HomeStayImage.bulkCreate(newImages);
    }

    // Return the updated homestay with associations
    const updatedHomeStay = await HomeStay.findByPk(homestay.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Homestay updated successfully",
      data: updatedHomeStay,
    });
  } catch (error) {
    console.error("Error updating homestay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* delete */
exports.deleteHomeStay = async (req, res) => {
  const { id } = req.params;

  try {
    const homestay = await HomeStay.findByPk(id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || homestay.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to delete this homestay",
        });
      }
    }

    await homestay.destroy();

    return res.status(200).json({
      success: true,
      message: "Homestay deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting homestay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* restore homestays */
exports.restoreHomeStay = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the homestay (including soft-deleted ones)
    const homestay = await HomeStay.findOne({
      where: { id },
      paranoid: false,
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
        {
          model: HomeStayImage,
          as: "images",
          attributes: ["id", "imageUrl", "fileName"],
          order: [["sortOrder", "ASC"]],
        },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || homestay.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to restore this homestay",
        });
      }
    }

    // Check if already restored
    if (homestay.deletedAt === null) {
      return res.status(400).json({
        success: false,
        message: "Homestay is not deleted",
      });
    }

    // Restore the homestay
    await homestay.restore();

    return res.status(200).json({
      success: true,
      message: "Homestay restored successfully",
      data: homestay,
    });
  } catch (error) {
    console.error("Error restoring homestay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* vista verification */
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

    const homestay = await HomeStay.findByPk(req.params.id);

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !homestay.vistaVerified;

    await homestay.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      data: {
        id: homestay.id,
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

/* update active status */
exports.updateHomeStayStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update homestay status",
      });
    }

    const homestay = await HomeStay.findByPk(req.params.id);

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // Determine new status (toggle if not specified)
    const newActiveStatus =
      req.body.isActive !== undefined ? req.body.isActive : !homestay.isActive;

    await homestay.update({
      isActive: newActiveStatus,
      availabilityStatus: newActiveStatus ? "available" : "unavailable",
    });

    return res.status(200).json({
      success: true,
      message: "Homestay status updated successfully",
      data: {
        id: homestay.id,
        isActive: newActiveStatus,
        availabilityStatus: newActiveStatus ? "available" : "unavailable",
      },
    });
  } catch (error) {
    console.error("Error updating homestay status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update homestay status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update HomeStay Availability Status */
exports.updateAvailabilityStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { availabilityStatus } = req.body;

    // Find homestay with merchant info
    const homestay = await HomeStay.findByPk(id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || homestay.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You can only update availability for your own homestays",
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
    await homestay.update({ availabilityStatus });

    return res.status(200).json({
      success: true,
      message: "Availability status updated successfully",
      data: {
        id: homestay.id,
        availabilityStatus: homestay.availabilityStatus,
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

/* Update HomeStay Approval Status (Admin Only) */
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

    const homestay = await HomeStay.findByPk(id, {
      paranoid: false,
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "businessName"],
        },
      ],
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // Validate status transition
    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a homestay",
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
      updateData.rejectionReason = null;
    } else if (approvalStatus === "rejected") {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus === "changes_requested") {
      updateData.rejectionReason =
        rejectionReason || "Changes requested by admin";
    }

    // Update homestay
    await homestay.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Homestay approval status updated successfully",
      data: {
        id: homestay.id,
        approvalStatus: homestay.approvalStatus,
        rejectionReason: homestay.rejectionReason,
        approvedAt: homestay.approvedAt,
        merchant: homestay.merchant,
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
