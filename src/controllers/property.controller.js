const { Op, where } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../helpers/upload");
const Property = require("../models/property.model");
const PropertyImage = require("../models/propertyImage.model");
const Amenity = require("../models/amenity.model");
const User = require("../models/user.model");
const MerchantProfile = require("../models/merchantProfile.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, propertyId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "property", propertyId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    propertyId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

/* create properties */
exports.createProperty = async (req, res) => {
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

    const { amenities, ...propertyData } = req.body;

    // Generate slug if not provided
    if (!propertyData.slug && propertyData.title) {
      propertyData.slug = slugify(propertyData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    let merchantId;

    // Admin flow
    if (req.user.accountType === "admin") {
      if (!propertyData.merchantId) {
        return res.status(400).json({
          success: false,
          message: "merchantId is required for admin property creation",
        });
      }

      merchantId = propertyData.merchantId;

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
      const propertyCount = await Property.count({
        where: { merchantId },
      });

      if (propertyCount >= merchantExists.maxPropertiesAllowed) {
        return res.status(400).json({
          success: false,
          message: `Merchant has reached maximum allowed properties (${merchantExists.maxPropertiesAllowed})`,
        });
      }
    }
    // Merchant flow
    else {
      if (!user.merchantProfile) {
        return res.status(403).json({
          success: false,
          message: "Active merchant profile not found or not approved",
        });
      }

      merchantId = user.merchantProfile.id;

      // Check property limit
      const propertyCount = await Property.count({
        where: { merchantId },
      });

      if (propertyCount >= user.merchantProfile.maxPropertiesAllowed) {
        return res.status(400).json({
          success: false,
          message: `You have reached your maximum allowed properties (${user.merchantProfile.maxPropertiesAllowed})`,
        });
      }
    }

    // Set approval status
    propertyData.approvalStatus =
      user.accountType === "admin" ? "approved" : "pending";
    propertyData.merchantId = merchantId;

    if (user.accountType === "admin") {
      propertyData.approvedAt = new Date();
    }

    // Create the property
    const property = await Property.create(propertyData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, property.id);
    if (images.length > 0) {
      await PropertyImage.bulkCreate(images);
    }

    // Add amenities if provided
    if (amenities?.length) {
      await property.addAmenities(amenities);
    }

    // Return the created property with associations
    const propertyWithAssociations = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: propertyWithAssociations,
    });
  } catch (error) {
    console.error("Error creating property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create property",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/*  get all propeties */
exports.getAllProperties = async (req, res) => {
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
      propertyType,
      approvalStatus,
      availabilityStatus,
      merchantId,
      page = 1,
      limit = 10,
    } = req.body;

    const where = {};
    const include = [
      {
        model: PropertyImage,
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

    // Apply filters
    if (propertyType) where.propertyType = propertyType;
    if (city) where.city = city;
    if (district) where.district = district;
    if (province) where.province = province;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (merchantId) where.merchantId = merchantId;

    // Handle boolean filters
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

    // Handle user-specific filtering
    if (req.user) {
      // Check if user exists first
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
      // For unauthenticated requests, only show approved and active properties
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

    const { count, rows: properties } = await Property.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get property id */
exports.getPropertyById = async (req, res) => {
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
        model: PropertyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl", "fileName"],
      },
    ];

    // Handle user-specific filtering
    if (req.user) {
      // Check if user exists first
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
      paranoid: includeDeleted !== "true",
    };

    const property = await Property.findOne(options);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch property",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* update properties */
exports.updateProperty = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const property = await Property.findByPk(req.params.id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
        {
          model: PropertyImage,
          as: "images",
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || property.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update this property",
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

    console.log(updateData.merchantId);

    console.log(property.merchant.id);

    if (
      updateData.merchantId &&
      updateData.merchantId != property.merchant.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot change property ownership",
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

    await property.update(updateData);

    if (amenities) {
      await property.updateAmenities(amenities);
    }

    const uploadedImages = await handleImageUploads(req.files, property.id);
    newImages = [...uploadedImages];

    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          propertyId: property.id,
        })),
      ];
    }

    const existingImageKeys = property.images
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
      await PropertyImage.destroy({
        where: { propertyId: property.id },
        force: true,
      });
      await PropertyImage.bulkCreate(newImages);
    }

    // Return the updated property with associations
    const updatedProperty = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error updating property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* delete properties */
exports.deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the property first to check permissions
    const property = await Property.findOne({
      where: { id },
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || property.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to delete this property",
        });
      }
    }

    // Soft delete the property
    await property.destroy();

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete property",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* restore properties */
exports.restoreProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the property (including soft-deleted ones)
    const property = await Property.findOne({
      where: { id },
      paranoid: false,
      include: [
        {
          model: PropertyImage,
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

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || property.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to restore this property",
        });
      }
    }

    // Check if already restored
    if (property.deletedAt === null) {
      return res.status(400).json({
        success: false,
        message: "Property is not deleted",
      });
    }

    // Restore the property
    await property.restore();

    return res.status(200).json({
      success: true,
      message: "Property restored successfully",
      data: property,
    });
  } catch (error) {
    console.error("Error restoring property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore property",
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

    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !property.vistaVerified;

    await property.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      data: {
        id: property.id,
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
exports.updatePropertyStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update property status",
      });
    }

    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Determine new status (toggle if not specified)
    const newActiveStatus =
      req.body.isActive !== undefined ? req.body.isActive : !property.isActive;

    await property.update({
      isActive: newActiveStatus,
      availabilityStatus: newActiveStatus ? "available" : "unavailable",
    });

    return res.status(200).json({
      success: true,
      message: "Property status updated successfully",
      data: {
        id: property.id,
        isActive: newActiveStatus,
        availabilityStatus: newActiveStatus ? "available" : "unavailable",
      },
    });
  } catch (error) {
    console.error("Error updating property status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update Property Availability Status */
exports.updateAvailabilityStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { availabilityStatus } = req.body;

    // Find property with merchant info
    const property = await Property.findByPk(id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant || property.merchant.id !== merchant.id) {
        return res.status(403).json({
          success: false,
          message: "You can only update availability for your own properties",
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
    await property.update({ availabilityStatus });

    return res.status(200).json({
      success: true,
      message: "Availability status updated successfully",
      data: {
        id: property.id,
        availabilityStatus: property.availabilityStatus,
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

/* Update Property Approval Status (Admin Only) */
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

    const property = await Property.findByPk(id, {
      paranoid: false,
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "businessName"],
        },
      ],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Validate status transition
    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a property",
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

    // Update property
    await property.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Property approval status updated successfully",
      data: {
        id: property.id,
        approvalStatus: property.approvalStatus,
        rejectionReason: property.rejectionReason,
        approvedAt: property.approvedAt,
        merchant: property.merchant,
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
