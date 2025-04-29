// controllers/transportController.js
const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const TransportImage = require("../../models/transportImage.model");
const TransportReview = require("../../models/transportReview.model");

// Helper function for image handling
const handleImageUpload = async (files, transportId) => {
  const uploadDir = path.join(
    __dirname,
    "../../public/uploads/transport",
    transportId.toString()
  );

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const imagePaths = [];

  for (const file of files) {
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);
    const relativePath = `/uploads/transport/${transportId}/${fileName}`;

    await fs.promises.rename(file.path, filePath);
    imagePaths.push({
      transportId,
      imagePath: relativePath,
      isFeatured: false,
    });
  }

  return TransportImage.bulkCreate(imagePaths);
};

// Helper function to delete transport images
const deleteTransportImages = async (transportId) => {
  const images = await TransportImage.findAll({ where: { transportId } });

  for (const image of images) {
    await image.deleteFile();
  }

  // Delete the directory
  const uploadDir = path.join(
    __dirname,
    "../../public/uploads/transport",
    transportId.toString()
  );
  if (fs.existsSync(uploadDir)) {
    fs.rmdirSync(uploadDir, { recursive: true });
  }

  return TransportImage.destroy({ where: { transportId } });
};

// CRUD Operations
exports.createTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.create(req.body);

    if (req.files?.length) {
      await handleImageUpload(req.files, transport.id);
    }

    const result = await Transport.scope("withFullDetails").findByPk(
      transport.id
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
