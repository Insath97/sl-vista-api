const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const UploadService = require("../../helpers/upload");
const FoodAndBeverage = require("../../models/foodAndBeverages.model");
const FoodAndBeveragesImage = require("../../models/FoodAndBeverageImages.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, foodAndBeverageId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "food-and-beverage", foodAndBeverageId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    foodAndBeverageId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
  }));
};

/* Create food and beverage with images */
exports.createFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverageData = req.body;

    // Generate slug if not provided
    if (!foodAndBeverageData.slug && foodAndBeverageData.name) {
      foodAndBeverageData.slug = slugify(foodAndBeverageData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const foodAndBeverage = await FoodAndBeverage.create(foodAndBeverageData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, foodAndBeverage.id);
    if (images.length > 0) {
      await foodAndBeverage.addImages(images);
    }

    // Fetch with associations
    const foodAndBeverageWithAssociations = await FoodAndBeverage.findByPk(
      foodAndBeverage.id,
      {
        include: [
          {
            model: FoodAndBeveragesImage,
            as: "images",
            order: [["sortOrder", "ASC"]],
          },
        ],
      }
    );

    return res.status(201).json({
      success: true,
      message: "Food and beverage created successfully",
      data: foodAndBeverageWithAssociations,
    });
  } catch (error) {
    console.error("Error creating food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create food and beverage",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all food and beverages */
exports.getAllFoodAndBeverages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      includeDeleted,
      page = 1,
      limit = 10,
      search,
      city,
      province,
      cuisineType,
    } = req.query;

    const where = {};
    const include = [
      {
        model: FoodAndBeveragesImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (city) where.city = city;
    if (province) where.province = province;
    if (cuisineType) where.cuisineType = cuisineType;

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
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

    const { count, rows: foodAndBeverages } =
      await FoodAndBeverage.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: foodAndBeverages,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching food and beverages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch food and beverages",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get food and beverage by ID */
exports.getFoodAndBeverageById = async (req, res) => {
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
          model: FoodAndBeveragesImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const foodAndBeverage = await FoodAndBeverage.findOne(options);

    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: foodAndBeverage,
    });
  } catch (error) {
    console.error("Error fetching food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch food and beverage",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update food and beverage */
exports.updateFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(
      req.files,
      foodAndBeverage.id
    );
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

    // Update images
    if (newImages.length > 0) {
      await foodAndBeverage.updateImages(newImages);
    }

    await foodAndBeverage.update(updateData);

    // Fetch updated food and beverage
    const updatedFoodAndBeverage = await FoodAndBeverage.findByPk(
      foodAndBeverage.id,
      {
        include: [
          {
            model: FoodAndBeveragesImage,
            as: "images",
            order: [["sortOrder", "ASC"]],
          },
        ],
      }
    );

    return res.status(200).json({
      success: true,
      message: "Food and beverage updated successfully",
      data: updatedFoodAndBeverage,
    });
  } catch (error) {
    console.error("Error updating food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update food and beverage",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete food and beverage */
exports.deleteFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findByPk(req.params.id, {
      include: [{ model: FoodAndBeveragesImage, as: "images" }],
    });

    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = foodAndBeverage.images
      .map((img) => img.s3Key)
      .filter((key) => key);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await foodAndBeverage.destroy();

    return res.status(200).json({
      success: true,
      message: "Food and beverage deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete food and beverage",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore soft-deleted food and beverage */
exports.restoreFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found (including soft-deleted)",
      });
    }

    if (!foodAndBeverage.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Food and beverage is not deleted",
      });
    }

    await foodAndBeverage.restore();

    const restoredFoodAndBeverage = await FoodAndBeverage.findByPk(
      req.params.id,
      {
        include: [
          {
            model: FoodAndBeveragesImage,
            as: "images",
            order: [["sortOrder", "ASC"]],
          },
        ],
      }
    );

    return res.status(200).json({
      success: true,
      message: "Food and beverage restored successfully",
      data: restoredFoodAndBeverage,
    });
  } catch (error) {
    console.error("Error restoring food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore food and beverage",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle food and beverage active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    const newActiveStatus =
      req.body.active !== undefined
        ? req.body.active
        : !foodAndBeverage.isActive;

    await foodAndBeverage.update({ isActive: newActiveStatus });

    return res.status(200).json({
      success: true,
      message: "Food and beverage status toggled successfully",
      data: {
        id: foodAndBeverage.id,
        isActive: !foodAndBeverage.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling food and beverage status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle food and beverage status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Verify food and beverage */
exports.verifyFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !foodAndBeverage.vistaVerified;

    await foodAndBeverage.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Food and beverage verification status updated",
      data: {
        id: foodAndBeverage.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying food and beverage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update food and beverage images */
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const foodAndBeverage = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodAndBeverage) {
      return res.status(404).json({
        success: false,
        message: "Food and beverage not found",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, foodAndBeverage.id);

    if (images.length > 0) {
      await foodAndBeverage.updateImages(images);
    }

    const updatedFoodAndBeverage = await FoodAndBeverage.findByPk(
      foodAndBeverage.id,
      {
        include: [
          {
            model: FoodAndBeveragesImage,
            as: "images",
            order: [["sortOrder", "ASC"]],
          },
        ],
      }
    );

    return res.status(200).json({
      success: true,
      message: "Food and beverage images updated successfully",
      data: updatedFoodAndBeverage,
    });
  } catch (error) {
    console.error("Error updating food and beverage images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update food and beverage images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete food and beverage image */
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const image = await FoodAndBeveragesImage.findOne({
      where: {
        id: req.params.imageId,
        foodAndBeverageId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this food and beverage",
      });
    }

    // Delete from S3 if it's an S3-stored image
    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Food and beverage image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting food and beverage image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete food and beverage image",
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
    await FoodAndBeveragesImage.update(
      { isFeatured: false },
      {
        where: {
          foodAndBeverageId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
    const [affectedCount] = await FoodAndBeveragesImage.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          foodAndBeverageId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this food and beverage",
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
