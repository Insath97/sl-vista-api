const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const { sequelize } = require("../../config/database");
const User = require("../../models/user.model");
const CustomerProfile = require("../../models/customerProfile.model");

// Register new customer
exports.registerCustomer = async (req, res, next) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { firstName, lastName, email, password, mobileNumber } = req.body;

    // Create transaction for atomic operations
    const result = await sequelize.transaction(async (t) => {
      // Create user first
      const user = await User.create(
        {
          email,
          password,
          accountType: "customer",
          isActive: true,
        },
        { transaction: t }
      );

      // Then create customer profile
      const customerProfile = await CustomerProfile.create(
        {
          userId: user.id,
          firstName,
          lastName,
          mobileNumber,
        },
        { transaction: t }
      );

      return { user, customerProfile };
    });

    // Prepare response data
    const userData = result.user.toJSON();
    const customerData = result.customerProfile.toJSON();

    res.status(201).json({
      success: true,
      message: "Customer registration successful",
      data: {
        ...userData,
        customerProfile: customerData,
      },
    });
  } catch (err) {
    console.error("Customer registration error:", err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: err.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.listCustomers = async (req, res, next) => {
  try {
    // Validate request query
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      isActive,
      isSriLankan,
      search,
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where conditions
    const where = {
      accountType: "customer", 
    };
    const profileWhere = {};

    if (typeof isActive !== "undefined") {
      where.isActive = isActive;
    }

    if (typeof isSriLankan !== "undefined") {
      profileWhere.isSriLankan = isSriLankan;
    }

    if (search) {
      // Correct Op.like usage with case-insensitive search
      profileWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } }, // iLike for case-insensitive
        { lastName: { [Op.iLike]: `%${search}%` } },
        { mobileNumber: { [Op.like]: `%${search}%` } }, // like for exact case match on numbers
      ];

      // Also search in User model's email field
      where.email = { [Op.iLike]: `%${search}%` };
    }

    // Get customers with pagination
    const { count, rows } = await User.findAndCountAll({
      where,
      include: [
        {
          model: CustomerProfile,
          as: "customerProfile",
          where: profileWhere,
          required: true,
        },
      ],
      attributes: { exclude: ["password"] },
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true, // Important for correct count with includes
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Admin list customers error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
