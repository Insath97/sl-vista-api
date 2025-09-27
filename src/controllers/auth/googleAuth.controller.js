const { OAuth2Client } = require("google-auth-library");
const User = require("../../models/user.model");
const CustomerProfile = require("../../models/customerProfile.model");
const bcrypt = require("bcrypt");
const { generateToken, generateRefreshToken } = require("../../utils/auth");
const { setAuthCookies } = require("../../utils/cookies");

// Google OAuth client for web
const webClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_WEB_REDIRECT_URI
);

/**
 * Step 1: Redirect user to Google login
 */
exports.initiateWebGoogleAuth = (req, res) => {
  try {
    const redirectUrl =
      req.query.redirect_url ||
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    const authUrl = webClient.generateAuthUrl({
      access_type: "offline",
      scope: ["profile", "email"],
      prompt: "consent",
      redirect_uri: process.env.GOOGLE_WEB_REDIRECT_URI,
      state: encodeURIComponent(redirectUrl),
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Google auth:", error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
};

/**
 * Step 2: Handle Google callback and return user + tokens
 */
exports.handleWebGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "No authorization code received",
      });
    }

    const redirectUrl = decodeURIComponent(state || process.env.FRONTEND_URL);
    const allowedUrls = [
      process.env.FRONTEND_URL_1,
      process.env.FRONTEND_URL_2,
      process.env.FRONTEND_URL_3,
    ];

    if (!allowedUrls.includes(redirectUrl)) {
      return res.status(400).json({
        success: false,
        message: "Invalid redirect URL",
      });
    }

    // Exchange code for tokens
    const { tokens } = await webClient.getToken({
      code,
      redirect_uri: process.env.GOOGLE_WEB_REDIRECT_URI,
    });

    if (!tokens.id_token) {
      return res.status(400).json({
        success: false,
        message: "No ID token received from Google",
      });
    }

    // Verify ID token
    const ticket = await webClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    // Check if user exists
    let user = await User.findOne({
      where: { email },
      include: [
        {
          model: CustomerProfile,
          as: "customerProfile",
          required: false,
          attributes: ["id", "firstName", "lastName", "mobileNumber"],
        },
      ],
    });

    if (!user) {
      // Create new user
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 12);
      user = await User.create({
        email,
        googleId,
        password: randomPassword,
        accountType: "customer",
        isActive: true,
        isGoogleAuth: true,
      });

      await CustomerProfile.create({
        userId: user.id,
        firstName: payload.given_name || "User",
        lastName: payload.family_name || "",
        isActive: true,
      });

      // reload with profile
      user = await User.findByPk(user.id, {
        include: [
          {
            model: CustomerProfile,
            as: "customerProfile",
            required: false,
            attributes: ["id", "firstName", "lastName", "mobileNumber"],
          },
        ],
        attributes: { exclude: ["password"] },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      message: "Google authentication successful",
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).json({
      success: false,
      message: "Google authentication failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Optional: API endpoint for frontend to get user data after redirect
 */
exports.getUserData = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: CustomerProfile,
          as: "customerProfile",
          required: false,
          attributes: ["id", "firstName", "lastName", "mobileNumber"],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user data",
    });
  }
};