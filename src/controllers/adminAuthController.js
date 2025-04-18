const Admin = require("../models/admin.model");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");

let refreshTokens = [];

// Admin Login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ where: { email } });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // Store refresh token
    refreshTokens.push(refreshToken);

    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      admin: admin.toJSON(),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Refresh Token API
exports.refreshToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token required" });
  }

  // Check if token is valid and stored
  if (!refreshTokens.includes(token)) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid refresh token" });
  }

  try {
    const decoded = verifyRefreshToken(token);
    const newAccessToken = generateAccessToken({
      id: decoded.id,
      email: decoded.email,
    });

    res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired refresh token" });
  }
};

// Admin Logout
exports.logoutAdmin = (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token required" });
  }

  refreshTokens = refreshTokens.filter((t) => t !== token);
 
  res.status(200).json({ success: true, message: "Logout successful" });
};
