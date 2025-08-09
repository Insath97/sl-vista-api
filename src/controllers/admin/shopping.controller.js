const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Shopping = require("../../models/shoppings.model");
const ShoppingImages = require("../../models/shoppingimages.model");
const UploadService = require("../../helpers/upload");
const { Op } = require("sequelize");
// Helper function to handle image uploads
const handleImageUploads = async (files, shoppingId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "shopping", shoppingId)
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

/* Create shopping with images */
exports.createShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shoppingData = req.body;

    // Generate slug if not provided
    if (!shoppingData.slug && shoppingData.name) {
      shoppingData.slug = slugify(shoppingData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const shopping = await Shopping.create(shoppingData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, shopping.id);
    if (images.length > 0) {
      await ShoppingImages.bulkCreate(images);
    }

    // Fetch with associations
    const shoppingWithAssociations = await Shopping.findByPk(shopping.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Shopping created successfully",
      data: shoppingWithAssociations,
    });
  } catch (error) {
    console.error("Error creating shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create shopping",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all shoppings */
exports.getAllShoppings = async (req, res) => {
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
      category,
    } = req.query;

    const where = {};
    const include = [
      {
        model: ShoppingImages,
        as: "images",
        order: [["sortOrder", "ASC"]],
        attributes: ["id", "imageUrl", "fileName"],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (city) where.city = city;
    if (province) where.province = province;
    if (category) where.category = category;

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

    const { count, rows: shoppings } = await Shopping.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: shoppings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching shoppings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shoppings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get shopping by ID */
exports.getShoppingById = async (req, res) => {
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
          model: ShoppingImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const shopping = await Shopping.findOne(options);

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shopping,
    });
  } catch (error) {
    console.error("Error fetching shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shopping",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update shopping */
exports.updateShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Fetch shopping with its images
    const shopping = await Shopping.findByPk(req.params.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
        },
      ],
    });

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    // Handle file uploads
    const uploadedImages = await handleImageUploads(req.files, shopping.id);
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

    // Update slug if name changed
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

    // Get existing image keys before deleting
    const existingImageKeys = shopping.images
      .map((img) => img.s3Key)
      .filter((key) => key);

    // Delete existing images from S3 if they exist
    if (existingImageKeys.length > 0) {
      try {
        if (existingImageKeys.length === 1) {
          await UploadService.deleteFile(existingImageKeys[0]);
        } else {
          await UploadService.deleteMultipleFiles(existingImageKeys);
        }
      } catch (error) {
        console.error("Error deleting old images from S3:", error);
        // Continue with update even if S3 deletion fails
      }
    }

    // Update the main record
    await shopping.update(updateData);

    // Update images
    if (newImages.length > 0) {
      await ShoppingImages.destroy({
        where: { shoppingId: shopping.id }, // Fixed: Changed from 'id' to 'shoppingId'
        force: true,
      });
      await ShoppingImages.bulkCreate(newImages);
    }

    // Fetch updated shopping
    const updatedShopping = await Shopping.findByPk(shopping.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping updated successfully",
      data: updatedShopping,
    });
  } catch (error) {
    console.error("Error updating shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update shopping",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete shopping */
exports.deleteShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shopping = await Shopping.findByPk(req.params.id, {
      include: [{ model: ShoppingImages, as: "images" }],
    });

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
      });
    }

    // Get all S3 keys from images
    const s3Keys = shopping.images.map((img) => img.s3Key).filter((key) => key);

    // Delete all associated images from S3
    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await shopping.destroy();

    return res.status(200).json({
      success: true,
      message: "Shopping deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete shopping",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Restore soft-deleted shopping */
exports.restoreShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shopping = await Shopping.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found (including soft-deleted)",
      });
    }

    if (!shopping.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Shopping is not deleted",
      });
    }

    await shopping.restore();

    const restoredShopping = await Shopping.findByPk(req.params.id, {
      include: [
        {
          model: ShoppingImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
          attributes: ["id", "imageUrl", "fileName"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Shopping restored successfully",
      data: restoredShopping,
    });
  } catch (error) {
    console.error("Error restoring shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore shopping",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle shopping active status */
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
      });
    }

    await shopping.update({ isActive: !shopping.isActive });

    return res.status(200).json({
      success: true,
      message: "Shopping status toggled successfully",
      data: {
        id: shopping.id,
        isActive: !shopping.isActive,
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

/* Verify shopping */
exports.verifyShopping = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
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
    console.error("Error verifying shopping:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update shopping images */
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) {
      return res.status(404).json({
        success: false,
        message: "Shopping not found",
      });
    }

    // Handle file uploads
    const images = await handleImageUploads(req.files, shopping.id);

    if (images.length > 0) {
      await shopping.updateImages(images);
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

/* Delete shopping image */
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

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
        message: "Image not found for this shopping",
      });
    }

    // Delete from S3 if it's an S3-stored image
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

/* Set featured image */
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // First unset any currently featured image
    await ShoppingImages.update(
      { isFeatured: false },
      {
        where: {
          shoppingId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set the new featured image
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
        message: "Image not found for this shopping",
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
