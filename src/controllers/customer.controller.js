const { OAuth2Client } = require("google-auth-library");
const { validationResult } = require("express-validator");
const { sequelize } = require("../config/database");
const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const CustomerProfile = require("../models/customerProfile.model");

/* customer registration */
exports.registerCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const transaction = await sequelize.transaction();

  try {
    const { email, password, firstName, lastName, mobileNumber } = req.body;

    // Create user
    const user = await User.create(
      {
        email,
        password,
        accountType: "customer",
        isActive: true,
      },
      { transaction }
    );

    // Create customer profile
    const customerProfile = await CustomerProfile.create(
      {
        userId: user.id,
        firstName,
        lastName,
        mobileNumber,
        isActive: true,
      },
      { transaction }
    );

    await transaction.commit();

    // Get the created customer with user details
    const createdCustomer = await CustomerProfile.findByPk(customerProfile.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "accountType", "isActive"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      data: createdCustomer,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error registering customer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register customer",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* google auth */
exports.googleAuth = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { token } = req.body;

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload["sub"];
    const email = payload["email"];
    const givenName = payload["given_name"] || "";
    const familyName = payload["family_name"] || "";

    // Check if user exists in the database
    let user = await User.findOne({ where: { googleId } });

    if (!user) {
      // Check if user exists by email (to handle case where user registered with email first)
      user = await User.findOne({ where: { email } });

      if (user) {
        // If user exists but doesn't have googleId, update it
        user.googleId = googleId;
        await user.save();
      } else {
        // If user doesn't exist, create a new customer user
        user = await User.create({
          email,
          googleId,
          password: await bcrypt.hash(
            Math.random().toString(36).slice(-12),
            12
          ), // Random password
          accountType: "customer", // Always set to customer for Google auth
          isActive: true,
          isGoogleAuth: true,
        });

        // Create customer profile with Google data
        await CustomerProfile.create({
          userId: user.id,
          firstName: givenName,
          lastName: familyName,
          mobileNumber: "", // Google doesn't provide mobile number
          isActive: true,
        });
      }
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);

    const userWithProfile = await User.findByPk(user.id, {
      include: [
        {
          model: CustomerProfile,
          as: "customerProfile",
          attributes: ["firstName", "lastName", "mobileNumber"],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: {
        user: userWithProfile,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid Google token",
    });
  }
};               

/* get all customers - admin only */
exports.getAllCustomers = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access this endpoint",
      });
    }

    const { isActive, search, page = 1, limit = 10 } = req.body;
    const where = {};
    const include = [
      {
        model: User,
        as: "user",
        attributes: ["id", "email", "accountType", "isActive"],
        where: {
          accountType: "customer", // Only include customer accounts
        },
      },
    ];

    // Apply filters
    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    // Search functionality
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { mobileNumber: { [Op.like]: `%${search}%` } },
        { "$user.email$": { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get customers with pagination
    const { count, rows: customers } = await CustomerProfile.findAndCountAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true, // Important for correct count with includes
    });

    return res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/*  Get customer by ID - admin only */
exports.getCustomerById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access customer details",
      });
    }

    const customer = await CustomerProfile.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "accountType", "isActive"],
          where: {
            accountType: "customer", // Ensure we're only getting customer accounts
          },
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Update customer - customer can only update their own profile */
exports.updateCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user is admin
    if (req.user.accountType !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access customer details",
      });
    }
    // Find customer profile
    const customer = await CustomerProfile.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check if the requesting user is the customer owner
    if (
      req.user.accountType === "customer" &&
      customer.userId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile",
      });
    }

    // Prevent admins from updating customer profiles
    if (req.user.accountType === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot update customer profiles",
      });
    }

    // Prepare update data (exclude sensitive fields)
    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      mobileNumber: req.body.mobileNumber,
    };

    // Update customer profile
    await customer.update(updateData);

    // If password is being updated, handle it separately
    if (req.body.password) {
      await customer.user.update({
        password: await bcrypt.hash(req.body.password, 12),
        lastPasswordChange: new Date(),
      });
    }

    // Return updated customer
    const updatedCustomer = await CustomerProfile.findByPk(customer.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "accountType", "isActive"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedCustomer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Change customer activation status (admin only) */
exports.changeCustomerStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Strict admin access check
    if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can change customer status",
      });
    }

    const customer = await CustomerProfile.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Determine new status (toggle if not specified)
    const newActiveStatus =
      req.body.isActive !== undefined ? req.body.isActive : !customer.isActive;

    // Update both customer profile and user status
    await customer.update({ isActive: newActiveStatus });
    await customer.user.update({ isActive: newActiveStatus });

    return res.status(200).json({
      success: true,
      message: "Customer status updated successfully",
      data: {
        id: customer.id,
        isActive: newActiveStatus,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error changing customer status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change customer status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
