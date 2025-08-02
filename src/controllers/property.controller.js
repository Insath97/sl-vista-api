const { Op } = require("sequelize");
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
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
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

    // Handle merchant ID based on user type
    if (user.accountType === "merchant") {
      // For merchants, use their own merchant profile ID
      if (!user.merchantProfile) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Check if merchant profile is active
      if (user.merchantProfile.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your merchant account is not active",
        });
      }

      propertyData.merchantId = user.merchantProfile.id;
    } else if (user.accountType === "admin") {
      // For admins, require merchantId in the request body
      if (!req.body.merchantId) {
        // Changed from propertyData.merchantId to req.body.merchantId
        return res.status(400).json({
          success: false,
          message: "merchantId is required when creating property as admin",
        });
      }

      // Validate the merchant exists
      const merchantExists = await MerchantProfile.findByPk(
        req.body.merchantId
      );
      if (!merchantExists) {
        return res.status(400).json({
          success: false,
          message: "Specified merchant profile not found",
        });
      }

      propertyData.merchantId = req.body.merchantId;
      console.log(propertyData.merchantId);
      
    } else {
      return res.status(403).json({
        success: false,
        message: "Only admin and merchant users can create properties",
      });
    }

    // Set approval status
    propertyData.approvalStatus =
      user.accountType === "admin" ? "approved" : "pending";
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
 
/*  get all propeties */
exports.getAllProperties = async (req, res) => {};

/* get property id */
exports.getPropertyById = async (req, res) => {};
 