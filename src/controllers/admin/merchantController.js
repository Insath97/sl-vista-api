const { query, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Fetch all merchants with filtering options
exports.listMerchants = async (req, res, next) => {
  try {
    // Validate query parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      businessType,
      isSriLankan,
      country,
      city,
      search,
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where conditions
    const where = {};
    const merchantWhere = {};

    if (status) merchantWhere.status = status;
    if (businessType) merchantWhere.businessType = businessType;
    if (isSriLankan !== undefined) merchantWhere.isSriLankan = isSriLankan;
    if (country) merchantWhere.country = { [Op.iLike]: `%${country}%` };
    if (city) merchantWhere.city = { [Op.iLike]: `%${city}%` };

    // Search across multiple fields
    if (search) {
      merchantWhere[Op.or] = [
        { businessName: { [Op.iLike]: `%${search}%` } },
        { businessRegistrationNumber: { [Op.iLike]: `%${search}%` } },
        { nicNumber: { [Op.iLike]: `%${search}%` } },
        { passportNumber: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Fetch merchants with associated user data
    const { count, rows } = await MerchantProfile.findAndCountAll({
      where: merchantWhere,
      include: [
        {
          model: User,
          as: "user",
          where: where,
          attributes: ["id", "email", "accountType", "isActive", "createdAt"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: false, // Include soft-deleted records if needed
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    // Prepare response
    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Error fetching merchants:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
