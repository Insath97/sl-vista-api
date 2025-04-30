const { Op } = require("sequelize");
const { validationResult } = require("express-validator");

const TransportType = require("../../models/transportType.model");
const Transport = require("../../models/transport.model");
const TransportImage = require("../../models/transportImage.model");
const TransportAmenity = require("../../models/transportAmenity.model");

const {
  uploadTransportImages,
  moveTempFiles,
} = require("../../middlewares/upload");

exports.createTransport = async (req, res) => {
  // 1. Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // 2. Create transport record
    const transport = await Transport.create(req.body);

    // 3. Handle amenities (if provided)
    if (req.body.amenities && req.body.amenities.length > 0) {
      await TransportAmenity.bulkCreate(
        req.body.amenities.map((amenity) => ({
          transportId: transport.id,
          amenityId: amenity.amenityId,
          isAvailable: amenity.isAvailable !== false,
          notes: amenity.notes || null,
        }))
      );
    }

    // 4. Process uploaded images
    if (req.files?.length > 0) {
      // Move files from temp folder to transport ID folder
      if (req.body.tempId) {
        await moveTempFiles(req.body.tempId, transport.id);
      }

      // Save image records
      await TransportImage.bulkCreate(
        req.files.map((file) => ({
          transportId: transport.id,
          imagePath: `/uploads/transports/${transport.id}/${file.filename}`,
          isFeatured: false,
        }))
      );
    }

    // 5. Return full transport data with relationships
    const result = await Transport.findByPk(transport.id, {
      include: ["images", "amenities"],
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Transport creation failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getAllTransports = async (req, res) => {
  try {
    const {
      // Pagination
      page = 1,
      limit = 10,

      // Basic Filters
      search,
      transportTypeId,
      minPrice,
      maxPrice,
      departureCity,
      arrivalCity,

      // Status Filters
      isActive,
      vistaVerified,

      // Amenity Filters
      amenities, // comma-separated IDs (e.g., "1,3,5")

      // Rating Filters
      minRating,

      // Date Filters
      createdAfter,
      createdBefore,

      // Sorting
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    // 1. Build the WHERE clause
    const where = {};

    // Text search
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { operatorName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Numeric/ID filters
    if (transportTypeId) where.transportTypeId = transportTypeId;
    if (departureCity)
      where.departureCity = { [Op.iLike]: `%${departureCity}%` };
    if (arrivalCity) where.arrivalCity = { [Op.iLike]: `%${arrivalCity}%` };
    if (minPrice) where.pricePerKmUSD = { [Op.gte]: parseFloat(minPrice) };
    if (maxPrice)
      where.pricePerKmUSD = {
        ...where.pricePerKmUSD,
        [Op.lte]: parseFloat(maxPrice),
      };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";

    // Date range
    if (createdAfter || createdBefore) {
      where.createdAt = {};
      if (createdAfter) where.createdAt[Op.gte] = new Date(createdAfter);
      if (createdBefore) where.createdAt[Op.lte] = new Date(createdBefore);
    }

    // 2. Handle amenities filter
    let amenityFilter = {};
    if (amenities) {
      const amenityIds = amenities.split(",").map((id) => parseInt(id.trim()));
      amenityFilter = {
        where: { amenityId: { [Op.in]: amenityIds } },
        group: "transportId",
        having: sequelize.literal(
          `COUNT(DISTINCT amenityId) = ${amenityIds.length}`
        ),
      };
    }

    // 3. Rating filter (subquery)
    if (minRating) {
      where[Op.and] = [
        sequelize.literal(`(
          SELECT AVG(rating)
          FROM transport_reviews
          WHERE 
            transport_reviews.transportId = transports.id AND
            transport_reviews.status = 'approved'
        ) >= ${parseFloat(minRating)}`),
      ];
    }

    // 4. Execute query
    const { count, rows } = await Transport.findAndCountAll({
      where,
      include: [
        {
          association: "amenities",
          ...amenityFilter,
          required: !!amenities, // LEFT JOIN if no amenities filter
        },
        {
          association: "images",
          attributes: ["id", "imagePath", "isFeatured"],
          limit: 1, // Only fetch 1 image per transport for listing
        },
        {
          association: "transportType",
          attributes: ["id", "name"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      subQuery: false,
      distinct: true, // Critical for correct counting with JOINs
    });

    // 5. Response
    res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch transports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
