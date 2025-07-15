const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const UploadService = require("../../helpers/upload");
const Property = require("../../models/property.model");
const PropertyImage = require("../../models/propertyImage.model");
const Amenity = require("../../models/amenity.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

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

/* Create property with images and amenities */
exports.createProperty = async (req, res) => {
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

    const { amenities, ...propertyData } = req.body;

    // Generate slug if not provided
    if (!propertyData.slug && propertyData.title) {
      propertyData.slug = slugify(propertyData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Set merchant ID
    propertyData.merchantId = user.merchantProfile.id;

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

    // Fetch with associations
    const propertyWithAssociations = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
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

/* Get all properties */
exports.getAllProperties = async (req, res) => {
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
      includeAmenities,
      includeMerchant,
      page = 1,
      limit = 10,
      search,
      propertyType,
      city,
      approvalStatus,
      availabilityStatus,
      merchantId,
    } = req.query;

    const where = {};
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: PropertyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      },
    ];

    if (includeMerchant === "true") {
      include.push({
        model: MerchantProfile,
        as: "merchant",
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "accountType"],
          },
        ],
      });
    }

    if (includeAmenities === "true") {
      include.push({
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      });
    }

    if (includeImages === "true") {
      include.push({
        model: PropertyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      });
    }

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (propertyType) where.propertyType = propertyType;
    if (city) where.city = city;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (merchantId) where.merchantId = merchantId;

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
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

/* Get property by ID */
exports.getPropertyById = async (req, res) => {
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
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
        {
          model: MerchantProfile,
          as: "merchant",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "email", "accountType"],
            },
          ],
        },
      ],
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

/* Update property */
exports.updateProperty = async (req, res) => {
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not owned by merchant",
      });
    }

    const { amenities, images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, property.id);
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
      updateData.title !== property.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Update amenities if provided
    if (amenities) {
      await property.setAmenities(amenities);
    }

    // Update images if provided
    if (newImages.length > 0) {
      await PropertyImage.destroy({
        where: { propertyId: property.id },
      });
      await PropertyImage.bulkCreate(newImages);
    }

    await property.update(updateData);

    // Fetch updated property
    const updatedProperty = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
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

/* Delete property */
exports.deleteProperty = async (req, res) => {
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
      include: [{ model: PropertyImage, as: "images" }],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not owned by merchant",
      });
    }

    // Get all S3 keys from images
    const s3Keys = property.images.map((img) => img.s3Key).filter(Boolean);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      await UploadService.deleteMultipleFiles(s3Keys);
    }

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

/* Restore property */
exports.restoreProperty = async (req, res) => {
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
      paranoid: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found (including soft-deleted)",
      });
    }

    if (!property.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Property is not deleted",
      });
    }

    await property.restore();

    const restoredProperty = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Property restored successfully",
      data: restoredProperty,
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

/* Toggle property active status */
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not owned by merchant",
      });
    }

    await property.update({ isActive: !property.isActive });

    return res.status(200).json({
      success: true,
      message: "Property status toggled successfully",
      data: {
        id: property.id,
        isActive: !property.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling property status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle property status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Verify property */
exports.verifyProperty = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Only admin can verify properties
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can verify properties",
      });
    }

    const property = await Property.findByPk(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const { verified, approvalStatus, rejectionReason } = req.body;

    const updateData = {};
    if (verified !== undefined) updateData.vistaVerified = verified;
    if (approvalStatus) updateData.approvalStatus = approvalStatus;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;

    await property.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Property verification status updated",
      data: {
        id: property.id,
        vistaVerified: property.vistaVerified,
        approvalStatus: property.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying property:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update property amenities */
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not owned by merchant",
      });
    }

    const { amenities } = req.body;

    await property.setAmenities(amenities);

    const updatedProperty = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Property amenities updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error updating property amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update property images */
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

    const property = await Property.findOne({
      where: {
        id: req.params.id,
        merchantId: user.merchantProfile.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not owned by merchant",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, property.id);

    if (images.length > 0) {
      await PropertyImage.destroy({
        where: { propertyId: property.id },
      });
      await PropertyImage.bulkCreate(images);
    }

    const updatedProperty = await Property.findByPk(property.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Property images updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error updating property images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete property image */
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

    const image = await PropertyImage.findOne({
      where: {
        id: req.params.imageId,
        propertyId: req.params.id,
      },
      include: [
        {
          model: Property,
          as: "property",
          where: { merchantId: user.merchantProfile.id },
        },
      ],
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this property",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Property image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting property image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete property image",
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
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    // First unset any currently featured image
    await PropertyImage.update(
      { isFeatured: false },
      {
        where: {
          propertyId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await PropertyImage.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          propertyId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this property",
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

/* get all approved properties */
exports.getAllApprovedProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      propertyType,
      city,
      minPrice,
      maxPrice,
    } = req.query;

    const where = {
      approvalStatus: "approved",
      availabilityStatus: "available",
      isActive: true,
    };

    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: PropertyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      },
      {
        model: MerchantProfile,
        as: "merchant",
        attributes: ["id", "businessName"],
      },
    ];

    // Filter conditions
    if (propertyType) where.propertyType = propertyType;
    if (city) where.city = { [Op.like]: `%${city}%` };

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
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
    console.error("Error fetching approved properties:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* update properties available status*/
exports.updatePropertyApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    const property = await Property.findByPk(id, {
      paranoid: false, // Include soft-deleted properties if needed
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

    const updateData = {
      approvalStatus,
      lastStatusChange: new Date(),
    };

    if (approvalStatus === "approved") {
      updateData.approvedAt = new Date();
      updateData.rejectionReason = null;
    } else if (approvalStatus === "rejected") {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus === "changes_requested") {
      updateData.rejectionReason =
        rejectionReason || "Changes requested by admin";
    }

    await property.update(updateData);

    // Fetch updated property with associations
    const updatedProperty = await Property.findByPk(id, {
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "businessName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Property approval status updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error updating property approval status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property approval status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get all merchant properties */
exports.getAllMerchantProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      propertyType,
      city,
      merchantId,
      approvalStatus,
      availabilityStatus,
      isActive,
      vistaVerified,
    } = req.query;

    const where = {};
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: PropertyImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      },
      {
        model: MerchantProfile,
        as: "merchant",
        attributes: ["id", "businessName"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "accountType", "isActive"],
          },
        ],
      },
    ];

    // Filter conditions
    if (propertyType) where.propertyType = propertyType;
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (merchantId) where.merchantId = merchantId;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
        { "$merchant.businessName$": { [Op.like]: `%${search}%` } },
      ];
    }

    const options = {
      where,
      include,
      distinct: true,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: false, // Include soft-deleted records if needed
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
    console.error("Error fetching merchant properties:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant properties",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get approved property by ID (Public endpoint) */
exports.getApprovedPropertyById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;

    // Base conditions for approved properties
    const where = {
      id,
      approvalStatus: "approved",
      isActive: true,
    };

    // Admins can view unapproved properties too
    if (req.user?.accountType === "admin") {
      delete where.approvalStatus;
      delete where.isActive;
    }

    const property = await Property.findOne({
      where,
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: PropertyImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "businessName", "phoneNumber"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "accountType"],
            },
          ],
        },
      ],
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message:
          req.user?.accountType === "admin"
            ? "Property not found"
            : "Approved property not found or unavailable",
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
      message: "Failed to fetch property details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* merchant properties list */
exports.getMerchantPropertiesForDropdown = async (req, res) => {
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

    console.log(user.merchantProfile.id);

    const properties = await Property.findAll({
      where: {
        merchantId: user.merchantProfile.id,
        approvalStatus: "pending",
        availabilityStatus: "available",
        isActive: true,
      },
      attributes: ["id", "title"],
      order: [["title", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: properties,
    });
  } catch (error) {
    console.error("Property dropdown error:", {
      error: error.message,
      requestUser: req.user
        ? {
            id: req.user.id,
            hasMerchantProfile: !!req.user.merchantProfile,
            hasDataUser: !!req.user.data?.user,
          }
        : "No user object",
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get approved properties for dropdown (admin sees all, merchant sees only theirs) */
exports.getApprovedPropertiesForDropdown = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User not found",
      });
    }

    // Base query conditions
    const where = {
      approvalStatus: "approved",
      availabilityStatus: "available",
      isActive: true,
    };

    // For merchants, only show their properties
    if (user.accountType === "merchant" && !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    if (user.accountType === "merchant") {
      where.merchantId = user.merchantProfile.id;
    }

    const properties = await Property.findAll({
      where,
      attributes: ["id", "title"],
      order: [["title", "ASC"]],
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["businessName"],
          required: true,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: properties,
    });
  } catch (error) {
    console.error("Approved properties dropdown error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch approved properties",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

