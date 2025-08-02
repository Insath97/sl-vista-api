const { validationResult } = require("express-validator");
const slugify = require("slugify");
const FoodAndBeverage = require("../../models/foodAndBeverages.model");
const FoodAndBeveragesImage = require("../../models/FoodAndBeverageImages.model");
const UploadService = require("../../helpers/upload");
const { Op } = require("sequelize");

// Helper function to handle image uploads
const handleFoodAndBeverageImageUploads = async (files, foodAndBeverageId) => {
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
    mimetype: file.mimetype,
  }));
};

// Create foodAndBeverages with images
exports.createFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { ...foodData } = req.body;

    if (!foodData.slug && foodData.name) {
      foodData.slug = slugify(foodData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const food = await FoodAndBeverage.create(foodData);

    const images = await handleFoodAndBeverageImageUploads(req.files, food.id);
    if (images.length > 0) {
      await FoodAndBeveragesImage.bulkCreate(images);
    }

    const fullFood = await FoodAndBeverage.findByPk(food.id, {
      include: [
        {
          model: FoodAndBeveragesImage,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Food & Beverage item created successfully",
      data: fullFood,
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

// Get all FoodAndBeverages
exports.getAllFoodAndBeverages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const {
      isActive,
      includeDeleted,
      includeImages,
      search,
      city,
      province,
      cuisineType,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [
      {
        model: FoodAndBeveragesImage,
        as: "images",
        order: [["sortOrder", "ASC"]],
      },
    ];

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (city) where.city = city;
    if (province) where.province = province;
    if (cuisineType) where.cuisineType = cuisineType;


    const result = await FoodAndBeverage.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: includeDeleted !== "true", // soft delete toggle
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Food and Beverages fetched successfully",
      data: result.rows,
      pagination: {
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(result.count / limit),
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

// Get Food and Beverage By ID
exports.getFoodAndBeverageById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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

    const foodItem = await FoodAndBeverage.findOne(options);

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: foodItem,
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

// Update Food And Beverages
exports.updateFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    const uploadedImages = await handleFoodAndBeverageImageUploads(
      req.files,
      foodItem.id
    );
    newImages = [...uploadedImages];

    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          foodAndBeverageId: foodItem.id,
        })),
      ];
    }

    if (
      updateData.name &&
      !updateData.slug &&
      updateData.name !== foodItem.name
    ) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    await foodItem.update(updateData);

    if (newImages.length > 0) {
      await FoodAndBeveragesImage.destroy({
        where: { foodAndBeverageId: foodItem.id },
      });
      await FoodAndBeveragesImage.bulkCreate(newImages);
    }

    const updatedFoodItem = await FoodAndBeverage.findByPk(foodItem.id, {
      include: [
        {
          model: FoodAndBeveragesImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Food and Beverage item updated successfully",
      data: updatedFoodItem,
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

// Delete Food And Beverages
exports.deleteFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findByPk(req.params.id, {
      include: [{ model: FoodAndBeveragesImage, as: "images" }],
    });

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    const s3Keys = foodItem.images.map((img) => img.s3Key).filter(Boolean);

    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await foodItem.destroy();

    return res.status(200).json({
      success: true,
      message: "Food and Beverage item deleted successfully",
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

// Restore soft-deleted Food And Beverages
exports.restoreFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found (including soft-deleted)",
      });
    }

    if (!foodItem.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Food and Beverage item is not deleted",
      });
    }

    await foodItem.restore();

    const restoredItem = await FoodAndBeverage.findByPk(req.params.id, {
      include: [
        {
          model: FoodAndBeveragesImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Food and Beverage item restored successfully",
      data: restoredItem,
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

// Toggle Food And Beverages Active status
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    const newStatus = !foodItem.isActive;
    await foodItem.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Food and Beverage status toggled successfully",
      data: {
        id: foodItem.id,
        isActive: newStatus,
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

// Verify Food And Beverages
exports.verifyFoodAndBeverage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !foodItem.vistaVerified;

    await foodItem.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Food and Beverage verification status updated",
      data: {
        id: foodItem.id,
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

// Update Food And Beverage Images
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const foodItem = await FoodAndBeverage.findByPk(req.params.id);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Food and Beverage item not found",
      });
    }

    const images = await handleFoodAndBeverageImageUploads(
      req.files,
      foodItem.id
    );

    if (images.length > 0) {
      await FoodAndBeveragesImage.destroy({
        where: { foodAndBeverageId: foodItem.id },
      });
      await FoodAndBeveragesImage.bulkCreate(images);
    }

    const updatedFoodItem = await FoodAndBeverage.findByPk(foodItem.id, {
      include: [
        {
          model: FoodAndBeveragesImage,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Food and Beverage images updated successfully",
      data: updatedFoodItem,
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

// Delete Food and Beverages images
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

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
        message: "Image not found for this food and beverage item",
      });
    }

    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Food and Beverage image deleted successfully",
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

// Set Featured Image
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    await FoodAndBeveragesImage.update(
      { isFeatured: false },
      {
        where: {
          foodAndBeverageId: req.params.id,
          isFeatured: true,
        },
      }
    );

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
        message: "Image not found for this food and beverage item",
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
