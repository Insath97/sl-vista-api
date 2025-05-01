const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");
const Amenity = require("../../models/amenity.model");

/* Create transport*/
exports.createTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amenities, ...transportData } = req.body;

    // Generate slug if not provided
    if (!transportData.slug && transportData.title) {
      transportData.slug = slugify(transportData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    const transport = await Transport.create(transportData);

    // Add amenities if provided
    if (amenities && amenities.length) {
      await transport.addAmenities(amenities);
    }

    // Fetch the transport with amenities
    const transportWithAmenities = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Transport created successfully",
      data: transportWithAmenities,
    });
  } catch (error) {
    console.error("Error creating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all transports */
exports.getAllTransports = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      transportTypeId,
      departureCity,
      arrivalCity,
      minSeats,
      maxPrice,
      isActive,
      vistaVerified,
      includeDeleted,
      page = 1,
      limit = 10,
      search,
      amenities,
    } = req.query;

    const where = {};
    const include = [
      { model: TransportType, as: "transportType" },
      {
        model: Amenity,
        as: "amenities",
        where: amenities ? { id: { [Op.in]: amenities.split(",") } } : {},
        required: !!amenities,
        through: { attributes: ["isAvailable", "notes"] },
      },
    ];

    if (transportTypeId) where.transportTypeId = transportTypeId;
    if (departureCity)
      where.departureCity = { [Op.iLike]: `%${departureCity}%` };
    if (arrivalCity) where.arrivalCity = { [Op.iLike]: `%${arrivalCity}%` };
    if (minSeats) where.seatCount = { [Op.gte]: minSeats };
    if (maxPrice) where.pricePerKmUSD = { [Op.lte]: maxPrice };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { operatorName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
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

    const { count, rows: transports } = await Transport.findAndCountAll(
      options
    );

    return res.status(200).json({
      success: true,
      data: transports,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transports",
    });
  }
};

/* Get transport by ID */
exports.getTransportById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;
    const options = {
      where: { id: req.params.id },
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
      ],
      paranoid: includeDeleted !== "true",
    };

    const transport = await Transport.findOne(options);

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: transport,
    });
  } catch (error) {
    console.error("Error fetching transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transport",
    });
  }
};

/* Update transport - Modified to handle vistaVerified */
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

    const { amenities, ...updateData } = req.body;

    // Generate new slug if title is being updated and slug isn't provided
    if (
      updateData.title &&
      !updateData.slug &&
      updateData.title !== transport.title
    ) {
      updateData.slug = slugify(updateData.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // Validate the slug won't conflict with others
    if (updateData.slug) {
      const existing = await Transport.findOne({
        where: {
          slug: updateData.slug,
          id: { [Op.ne]: req.params.id },
        },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Slug is already in use by another transport",
        });
      }
    }

    if ("vistaVerified" in updateData) {
      delete updateData.vistaVerified;
    }

    // Handle amenities if provided
    if (amenities) {
      await transport.setAmenities(amenities);
    }

    await transport.update(updateData);

    // Fetch the updated record with associations
    const updatedTransport = await Transport.findByPk(req.params.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete transport */
exports.deleteTransport = async (req, res) => {
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

    await transport.destroy();
    return res.status(200).json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transport",
    });
  }
};

/* Restore soft-deleted transport */
exports.restoreTransport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const transport = await Transport.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "Transport not found (including soft-deleted)",
      });
    }

    if (!transport.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Transport is not deleted",
      });
    }

    await transport.restore();

    const restoredTransport = await Transport.findByPk(req.params.id, {
      include: [
        { model: TransportType, as: "transportType" },
        { model: Amenity, as: "amenities" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport restored successfully",
      data: restoredTransport,
    });
  } catch (error) {
    console.error("Error restoring transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore transport",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Toggle transport active status */
exports.toggleActiveStatus = async (req, res) => {
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

    await transport.update({ isActive: !transport.isActive });

    return res.status(200).json({
      success: true,
      message: "Transport status toggled successfully",
      data: {
        id: transport.id,
        isActive: !transport.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling transport status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle transport status",
    });
  }
};

/* Verify transport */
exports.verifyTransport = async (req, res) => {
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

    // Toggle verification status or set based on request body
    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !transport.vistaVerified;

    await transport.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Transport verification status updated",
      data: {
        id: transport.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying transport:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update transport amenities */
exports.updateTransportAmenities = async (req, res) => {
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

    const { amenities } = req.body;

    // Clear existing amenities if empty array is provided
    if (Array.isArray(amenities)) {
      if (amenities.length === 0) {
        await transport.setAmenities([]);
      } else {
        // Update amenities with their specific attributes
        await Promise.all(
          amenities.map(async (amenity) => {
            await transport.sequelize.models.TransportAmenity.upsert({
              transportId: transport.id,
              amenityId: amenity.amenityId,
              isAvailable:
                amenity.isAvailable !== undefined ? amenity.isAvailable : true,
              notes: amenity.notes || null,
            });
          })
        );
      }
    }

    // Fetch the updated transport with amenities
    const updatedTransport = await Transport.findByPk(transport.id, {
      include: [
        { model: TransportType, as: "transportType" },
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Transport amenities updated successfully",
      data: updatedTransport,
    });
  } catch (error) {
    console.error("Error updating transport amenities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transport amenities",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
