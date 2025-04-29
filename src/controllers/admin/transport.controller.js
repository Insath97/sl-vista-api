const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const TransportImage = require("../../models/transportImage.model");
const TransportReview = require("../../models/transportReview.model");

// Image Handling Helpers
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

const deleteTransportImages = async (transportId) => {
  const images = await TransportImage.findAll({ where: { transportId } });

  for (const image of images) {
    await image.deleteFile();
  }

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

// Main Controller Methods
exports.getAllTransports = async (req, res) => {
  try {
    const {
      includeInactive,
      transportType,
      search,
      page = 1,
      limit = 10,
    } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (!includeInactive) where.isActive = true;
    if (transportType) where.transportTypeId = transportType;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { operatorName: { [Op.iLike]: `%${search}%` } },
        { departureCity: { [Op.iLike]: `%${search}%` } },
        { arrivalCity: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Transport.findAndCountAll({
      where,
      include: ["transportType", "images"],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
    });
  }
};

exports.getTransportById = async (req, res) => {
  try {
    const transport = await Transport.scope("withFullDetails").findByPk(
      req.params.id,
      {
        paranoid: req.query.includeDeleted === "true" ? false : true,
      }
    );

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    res.json({ success: true, data: transport });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transport",
    });
  }
};

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

exports.updateTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    if (req.body.title && req.body.title !== transport.title) {
      req.body.slug = slugify(req.body.title, { lower: true, strict: true });
    }

    await transport.update(req.body);

    if (req.files?.length) {
      await deleteTransportImages(transport.id);
      await handleImageUpload(req.files, transport.id);
    }

    const result = await Transport.scope("withFullDetails").findByPk(
      transport.id
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update transport",
    });
  }
};

exports.deleteTransport = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    await deleteTransportImages(transport.id);
    await transport.destroy();

    res.json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete transport",
    });
  }
};

exports.restoreTransport = async (req, res) => {
  try {
    const transport = await Transport.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    if (!transport.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport is not deleted",
      });
    }

    await transport.restore();
    res.json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to restore transport",
    });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    transport.isActive = !transport.isActive;
    await transport.save();

    res.json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle status",
    });
  }
};

// Review Management
exports.addReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    const reviewData = {
      transportId: transport.id,
      rating: req.body.rating,
      text: req.body.text,
      status: req.user?.isAdmin ? "approved" : "pending",
      isAnonymous: req.body.isAnonymous || false,
    };

    if (req.user && !reviewData.isAnonymous) {
      reviewData.userId = req.user.id;
    }

    const review = await TransportReview.create(reviewData);

    // Update transport's average rating
    const ratingInfo = await transport.getAverageRating();

    res.status(201).json({
      success: true,
      data: {
        review,
        averageRating: ratingInfo.averageRating,
        reviewCount: ratingInfo.reviewCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to add review",
    });
  }
};

exports.getTransportReviews = async (req, res) => {
  try {
    const transport = await Transport.findByPk(req.params.id);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    const { status = "approved", page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      transportId: transport.id,
      ...(status !== "all" && { status }),
    };

    const { count, rows } = await TransportReview.findAndCountAll({
      where,
      include: ["user"],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    res.json({
      success: true,
      data: {
        reviews: rows,
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
};

exports.moderateReview = async (req, res) => {
  try {
    const review = await TransportReview.findOne({
      where: {
        id: req.params.reviewId,
        transportId: req.params.id,
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (!["approve", "reject"].includes(req.body.action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    review.status = req.body.action === "approve" ? "approved" : "rejected";
    await review.save();

    const transport = await Transport.findByPk(req.params.id);
    const ratingInfo = await transport.getAverageRating();

    res.json({
      success: true,
      data: {
        review,
        averageRating: ratingInfo.averageRating,
        reviewCount: ratingInfo.reviewCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to moderate review",
    });
  }
};
