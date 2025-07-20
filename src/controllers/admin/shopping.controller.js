const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Shopping = require("../../models/shoppings.model");
const ShoppingImages = require("../../models/shoppingimages.model");
const UploadService = require("../../helpers/upload");
const { Op } = require("sequelize");

// 🔧 Helper function to upload images for Shopping
const handleShoppingImageUploads = async (files, shoppingId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "shoppings", shoppingId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);

  return uploadedFiles.map((file) => ({
    shoppingId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

//Create Shopping Controller
exports.createShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { ...shoppingData } = req.body;

    // Generate slug if not provided
    if (!shoppingData.slug && shoppingData.name) {
      shoppingData.slug = slugify(shoppingData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    //  Create the Shopping item
    const shopping = await Shopping.create(shoppingData);

    // Handle image uploads
    const images = await handleShoppingImageUploads(req.files, shopping.id);
    if (images.length > 0) {
      await ShoppingImages.bulkCreate(images);
    }

    //Fetch full shopping item with images
    const fullShopping = await Shopping.findByPk(shopping.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Shopping item created successfully",
      data: fullShopping,
    });
  } catch (error) {
    console.error("Error creating shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create shopping item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all Shopping items
exports.getAllShoppings = async (req, res) => {
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
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [];

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (city) where.city = city;
    if (province) where.province = province;

    if (includeImages === "true") {
      include.push({
        model: ShoppingImages,
        as: "images",
        separate: true,
        order: [["sortOrder", "ASC"]],
      });
    }

    const result = await Shopping.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: includeDeleted !== "true",
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping items fetched successfully",
      data: result.rows,
      pagination: {
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching shopping items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shopping items",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Shopping by ID
exports.getShoppingById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { includeDeleted } = req.query;

    const options = {
      where: { id: req.params.id },
      include: [
        {
          model: ShoppingImages,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const shopping = await Shopping.findOne(options);

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shopping,
    });
  } catch (error) {
    console.error("Error fetching shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shopping item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Update Shopping Controller
exports.updateShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // 📸 Upload new files (if any)
    const uploadedImages = await handleShoppingImageUploads(
      req.files,
      shopping.id
    );
    newImages = [...uploadedImages];

    // 🧩 Include any images passed via request body
    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          shoppingId: shopping.id,
        })),
      ];
    }

    // 🔁 Generate new slug if name changed and no slug provided
    if (
      updateData.name &&
      !updateData.slug &&
      updateData.name !== shopping.name
    ) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    //Update the shopping item
    await shopping.update(updateData);

    //Replace existing images if new ones provided
    if (newImages.length > 0) {
      await ShoppingImages.destroy({
        where: { shoppingId: shopping.id },
      });
      await ShoppingImages.bulkCreate(newImages);
    }

    // Fetch full updated shopping item with images
    const updatedShopping = await Shopping.findByPk(shopping.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping item updated successfully",
      data: updatedShopping,
    });
  } catch (error) {
    console.error("Error updating shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update shopping item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Delete Shopping Controller
exports.deleteShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findByPk(req.params.id, {
      include: [{ model: ShoppingImages, as: "images" }],
    });

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    const s3Keys = shopping.images.map((img) => img.s3Key).filter(Boolean);

    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await shopping.destroy(); // Soft delete due to paranoid: true

    return res.status(200).json({
      success: true,
      message: "Shopping item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete shopping item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//  Restore soft-deleted Shopping item
exports.restoreShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found (including soft-deleted)",
      });
    }

    if (!shopping.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Shopping item is not deleted",
      });
    }

    await shopping.restore();

    const restoredShopping = await Shopping.findByPk(req.params.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping item restored successfully",
      data: restoredShopping,
    });
  } catch (error) {
    console.error("Error restoring shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore shopping item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Toggle Shopping Active Status
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findByPk(req.params.id);

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    const newStatus = !shopping.isActive;
    await shopping.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Shopping item status toggled successfully",
      data: {
        id: shopping.id,
        isActive: newStatus,
      },
    });
  } catch (error) {
    console.error("Error toggling shopping status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle shopping status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify Shopping Item
exports.verifyShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findByPk(req.params.id);

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !shopping.vistaVerified;

    await shopping.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Shopping verification status updated",
      data: {
        id: shopping.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying shopping item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Shopping Images
exports.updateShoppingImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping item not found",
      });
    }

    const images = await handleShoppingImageUploads(req.files, shopping.id);

    if (images.length > 0) {
      await ShoppingImages.destroy({
        where: { shoppingId: shopping.id },
      });
      await ShoppingImages.bulkCreate(images);
    }

    const updatedShopping = await Shopping.findByPk(shopping.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping images updated successfully",
      data: updatedShopping,
    });
  } catch (error) {
    console.error("Error updating shopping images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update shopping images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Delete shopping image
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const image = await ShoppingImages.findOne({
      where: {
        id: req.params.imageId,
        shoppingId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this shopping item",
      });
    }

    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Shopping image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting shopping image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete shopping image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Set new features image
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    // Remove existing featured image for the shopping item
    await ShoppingImages.update(
      { isFeatured: false },
      {
        where: {
          shoppingId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set new featured image
    const [affectedCount] = await ShoppingImages.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          shoppingId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this shopping item",
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
