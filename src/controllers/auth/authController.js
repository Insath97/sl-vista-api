const User = require("../../models/user.model");
const AdminProfile = require("../../models/adminProfile.model");
const MerchantProfile = require("../../models/merchantProfile.model");
const CustomerProfile = require("../../models/customerProfile.model");
const Permission = require("../../models/permisson.model");
const Role = require("../../models/role.model");

const { validationResult } = require("express-validator");
const { setAuthCookies, clearAuthCookies } = require("../../utils/cookies");
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../../utils/auth");

// Common login function
const loginUser = async (req, res, accountType) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user with password and include profile based on account type
    const includeOptions =
      accountType === "admin"
        ? [{ model: AdminProfile, as: "adminProfile" }]
        : accountType === "merchant"
        ? [{ model: MerchantProfile, as: "merchantProfile" }]
        : [{ model: CustomerProfile, as: "customerProfile" }]; // Added customer profile

    const foundUser = await User.scope("withPassword").findOne({
      where: { email },
      include: includeOptions,
    });

    if (!foundUser || !(await foundUser.isPasswordMatch(password))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    if (foundUser.accountType !== accountType) {
      return res.status(403).json({
        success: false,
        message: `Not authorized as ${accountType}`,
      });
    }

    const accessToken = generateToken(foundUser);
    const refreshToken = generateRefreshToken(foundUser);

    // Set cookies and get tokens
    const tokens = setAuthCookies(res, accessToken, refreshToken);

    const userData = foundUser.toJSON();
    delete userData.password;

    // Prepare response structure
    const response = {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          accountType: userData.accountType,
          isActive: userData.isActive,
          updatedAt: userData.updatedAt,
          createdAt: userData.createdAt,
          lastPasswordChange: userData.lastPasswordChange,
          ...(userData.adminProfile && { adminProfile: userData.adminProfile }),
          ...(userData.merchantProfile && {
            merchantProfile: userData.merchantProfile,
          }),
          ...(userData.customerProfile && {
            customerProfile: userData.customerProfile,
          }),
        },
        tokens,
      },
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Error logging in",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Admin login
exports.adminLogin = async (req, res) => {
  await loginUser(req, res, "admin");
};

// Merchant login
exports.merchantLogin = async (req, res) => {
  await loginUser(req, res, "merchant");
};

// Customer login
exports.customerLogin = async (req, res) => {
  await loginUser(req, res, "customer");
};

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const newAccessToken = generateToken(user);

    // Set new cookies if using cookie-based auth
    if (req.cookies.refreshToken) {
      setAuthCookies(res, newAccessToken, refreshToken);
    }

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    clearAuthCookies(res);
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Logout
exports.logout = (req, res) => {
  clearAuthCookies(res);
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

/* common user login */
exports.unifiedLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user with password and all associations
    const user = await User.scope("withPassword").findOne({
      where: { email },
      include: [
        { 
          model: Role,
          as: 'roles',
          include: {
            model: Permission,
            as: 'permissions'
          }
        },
        { model: AdminProfile, as: "adminProfile", required: false },
        { model: MerchantProfile, as: "merchantProfile", required: false },
        { model: CustomerProfile, as: 'customerProfile', required: false }
      ],
    });

    if (!user || !(await user.isPasswordMatch(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);

    // Prepare permissions array
    const permissions = [];
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (!permissions.includes(permission.name)) {
          permissions.push(permission.name);
        }
      });
    });

    // Prepare response
    const response = {
      success: true,
      userType: user.accountType,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        ...(user.adminProfile && { adminProfile: user.adminProfile }),
        ...(user.merchantProfile && { merchantProfile: user.merchantProfile }),
        ...(user.customerProfile && { customerProfile: user.customerProfile }),
        roles: user.roles.map(role => ({
          id: role.id,
          name: role.name,
          userType: role.userType
        }))
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};