const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const UploadService = require("../../helpers/upload");
const HomeStay = require("../../models/homeStay.model");
const HomeStayImage = require("../../models/homestayImage.model");
const Amenity = require("../../models/amenity.model");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

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

// Verify property belongs to merchant
const verifyPropertyOwnership = async (propertyId, merchantId) => {
  const property = await Property.findOne({
    where: { id: propertyId, merchantId },
  });
  if (!property) {
    throw new Error("Property not found or doesn't belong to merchant");
  }
  return property;
};

exports.createHomeStay = async (req, res) => {
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

    const { amenities = [], ...homestayData } = req.body;

    // Verify the property belongs to the merchant
    await verifyPropertyOwnership(
      homestayData.propertyId,
      user.merchantProfile.id
    );

    // Create the homestay
    const homestay = await HomeStay.create(homestayData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, homestay.id);
    if (images.length > 0) {
      await HomeStayImage.bulkCreate(images);
    }

    console.log(amenities);
    

    // Add amenities if provided (ensure it's always treated as array)
   if (amenities?.length) {
      await homestay.addAmenities(amenities);
    }

    // Get the complete homestay with associations
    const newHomeStay = await HomeStay.findByPk(homestay.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [
            ["isFeatured", "DESC"],
            ["sortOrder", "ASC"],
          ],
        },

      ],
    });

    return res.status(201).json({
      success: true,
      message: "Homestay created successfully",
      data: newHomeStay,
    });
  } catch (error) {
    console.error("Error creating homestay:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};