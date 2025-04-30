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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // 1. Parse amenities if provided
    let amenities = [];
    if (req.body.amenities) {
      try {
        amenities = Array.isArray(req.body.amenities)
          ? req.body.amenities
          : JSON.parse(req.body.amenities);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid amenities format",
        });
      }
    }

    // 2. Create transport (transaction ensures atomicity)
    const result = await sequelize.transaction(async (transaction) => {
      const transport = await Transport.create(req.body, { transaction });

      // 3. Process amenities
      if (amenities.length > 0) {
        await TransportAmenity.bulkCreate(
          amenities.map((amenity) => ({
            transportId: transport.id,
            amenityId: amenity.amenityId,
            isAvailable: amenity.isAvailable !== false,
            notes: amenity.notes || null,
          })),
          { transaction }
        );
      }

      // 4. Process images
      if (req.files?.length > 0) {
        const uploadDir = path.join(
          __dirname,
          `../../public/uploads/transports/${transport.id}`
        );
        fs.mkdirSync(uploadDir, { recursive: true });

        await TransportImage.bulkCreate(
          req.files.map((file) => {
            const newPath = path.join(uploadDir, file.filename);
            fs.renameSync(file.path, newPath);

            return {
              transportId: transport.id,
              imagePath: `/uploads/transports/${transport.id}/${file.filename}`,
              isFeatured: false,
            };
          }),
          { transaction }
        );
      }

      return transport;
    });

    // 5. Fetch complete data
    const transport = await Transport.findByPk(result.id, {
      include: ["images", "amenities"],
    });

    res.status(201).json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error("Creation error:", {
      message: error.message,
      stack: error.stack,
      ...(error.errors && { errors: error.errors }),
    });

    // Cleanup files if error occurred
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create transport",
      ...(process.env.NODE_ENV === "development" && {
        error: error.message,
        ...(error.errors && { details: error.errors }),
      }),
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
