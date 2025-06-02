const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const PropertySetting = require("../../models/propertySetting.model");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Helper to get merchant's property
const getMerchantProperty = async (userId, propertyId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: MerchantProfile, as: "merchantProfile" }]
  });
  
  if (!user || !user.merchantProfile) {
    throw new Error("Merchant profile not found");
  }

  const property = await Property.findOne({
    where: {
      id: propertyId,
      merchantId: user.merchantProfile.id
    }
  });

  if (!property) {
    throw new Error("Property not found or not owned by merchant");
  }

  return property;
};

/* Create property settings */
exports.createPropertySetting = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get property ID from route param and verify ownership
    const property = await getMerchantProperty(req.user.id, req.params.propertyId);

    // Check if settings already exist
    const existingSettings = await PropertySetting.findOne({
      where: { propertyId: property.id }
    });

    if (existingSettings) {
      return res.status(400).json({
        success: false,
        message: "Property settings already exist for this property"
      });
    }

    // Create settings with propertyId from verified property
    const settings = await PropertySetting.create({
      propertyId: property.id, // Use the verified property ID
      ...req.body
    });

    return res.status(201).json({
      success: true,
      message: "Property settings created successfully",
      data: settings
    });
  } catch (error) {
    console.error("Error creating property settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create property settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* Get property settings */
exports.getPropertySetting = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get property ID from route param and verify ownership
    const property = await getMerchantProperty(req.user.id, req.params.propertyId);

    const settings = await PropertySetting.findOne({
      where: { propertyId: property.id },
      include: [
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "propertyType"]
        }
      ]
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Property settings not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error("Error fetching property settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch property settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* Update property settings */
exports.updatePropertySetting = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get property ID from route param and verify ownership
    const property = await getMerchantProperty(req.user.id, req.params.propertyId);

    const settings = await PropertySetting.findOne({
      where: { propertyId: property.id }
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Property settings not found"
      });
    }

    await settings.update(req.body);

    return res.status(200).json({
      success: true,
      message: "Property settings updated successfully",
      data: settings
    });
  } catch (error) {
    console.error("Error updating property settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* Get all settings for merchant's properties */
exports.getAllMerchantPropertySettings = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ 
        model: MerchantProfile, 
        as: "merchantProfile",
        include: [{
          model: Property,
          as: "properties",
          include: [{
            model: PropertySetting,
            as: "settings"
          }]
        }]
      }]
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found"
      });
    }

    // Extract settings from all properties
    const settings = user.merchantProfile.properties
      .filter(property => property.settings)
      .map(property => ({
        propertyId: property.id,
        propertyTitle: property.title,
        ...property.settings.toJSON()
      }));

    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error("Error fetching merchant property settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch property settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};