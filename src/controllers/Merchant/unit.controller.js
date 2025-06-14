const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const UploadService = require("../../helpers/upload");
const Unit = require("../../models/unit.model");
const UnitImage = require("../../models/unitImage.model");
const Amenity = require("../../models/amenity.model");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, unitId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "unit", unitId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    unitId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

const getMerchantProperty = async (userId, propertyId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: MerchantProfile, as: "merchantProfile" }],
  });

  if (!user || !user.merchantProfile) {
    throw new Error("Merchant profile not found");
  }

  const property = await Property.findOne({
    where: {
      id: propertyId,
      merchantId: user.merchantProfile.id,
    },
  });

  if (!property) {
    throw new Error("Property not found or not owned by merchant");
  }

  return property;
};

exports.createUnit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Verify property ownership
    await getMerchantProperty(req.user.id, unitData.propertyId);

    const { amenities, ...unitData } = req.body;

    // Type-specific field handling
    if (unitData.type === "room") {
      if (!unitData.floorNumber) {
        return res.status(400).json({
          success: false,
          message: "floorNumber is required for room units",
        });
      }
    } else if (unitData.type === "home") {
      if (
        !unitData.bedConfiguration ||
        typeof unitData.bedConfiguration !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid bedConfiguration is required for home units",
        });
      }
    }

    const unit = await Unit.create(unitData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, unit.id);
    if (images.length > 0) {
      await UnitImage.bulkCreate(images);
    }

    // Add amenities if provided
    if (amenities?.length) {
      await unit.addAmenities(amenities);
    }

    const unitWithAssociations = await Unit.findByPk(unit.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: UnitImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: newUnit,
    });
  } catch (error) {
    console.error("Error creating unit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create unit",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
