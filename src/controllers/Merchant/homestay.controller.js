const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const UploadService = require("../../helpers/upload");
const HomeStay = require("../../models/homeStay.model");
const HomeStayImage = require("../../models/homestayImage.model");
const Amenity = require("../../models/amenity.model");
const Property = require("../../models/property.model");
const User = require("../../models/user.model");
const MerchantProfile = require("../../models/merchantProfile.model");

// Helper function to handle image uploads
const handleImageUploads = async (files, homestayId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "homestay", homestayId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  return uploadedFiles.map((file) => ({
    homestayId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

// Helper to verify homestay ownership
const verifyOwnership = async (homestayId, userId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: MerchantProfile, as: "merchantProfile" }],
  });

  if (!user || !user.merchantProfile) {
    throw new Error("Merchant profile not found");
  }

  const homestay = await HomeStay.findOne({
    where: {
      id: homestayId,
      merchantId: user.merchantProfile.id,
    },
  });

  if (!homestay) {
    throw new Error("Homestay not found or not owned by merchant");
  }

  return homestay;
};

/* ############################################################ merchant ########################################################### */

/* create homestays with login merchant */
 exports.createHomeStay = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const { amenities, ...homestayData } = req.body;

    homestayData.merchantId = user.merchantProfile.id;

    // Create the homestay
    const homestay = await HomeStay.create(homestayData);

    // Handle image uploads
    const images = await handleImageUploads(req.files, homestay.id);
    if (images.length > 0) {
      await HomeStayImage.bulkCreate(images);
    }

    console.log(amenities);

    // Add amenities if provided (ensure it's always treated as array)
    if (amenities?.length) {
      await homestay.addAmenities(amenities);
    }

    // Get the complete homestay with associations
    const newHomeStay = await HomeStay.findByPk(homestay.id, {
      /* include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [
            ["isFeatured", "DESC"],
            ["sortOrder", "ASC"],
          ],
        },
      ], */
    });

    console.log(newHomeStay);

    console.log("Final response data:", {
      success: true,
      message: "Homestay created successfully",
      data: newHomeStay,
    });

    return res.status(201).json({
      success: true,
      message: "Homestay created successfully",
      data: newHomeStay,
    });
  } catch (error) {
    console.error("Error creating homestay:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}; 


/* get all homestays for login merchant */
exports.getAllHomeStays = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: MerchantProfile, as: "merchantProfile" }],
    });

    if (!user || !user.merchantProfile) {
      return res.status(403).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    const {
      isActive,
      vistaVerified,
      page = 1,
      limit = 10,
      search,
      unitType,
      city,
      approvalStatus,
      availabilityStatus,
      merchantId,
      minGuests,
      maxGuests,
      minPrice,
      maxPrice,
      hasKitchen,
      hasPoolAccess,
      includeDeleted,
    } = req.query;

    const where = { merchantId: user.merchantProfile.id };
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [
          ["isFeatured", "DESC"],
          ["sortOrder", "ASC"],
        ],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (unitType) where.unitType = unitType;
    if (city) where.city = city;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (merchantId) where.merchantId = merchantId;
    if (minGuests) where.maxGuests = { [Op.gte]: minGuests };
    if (maxGuests)
      where.maxGuests = { ...where.maxGuests, [Op.lte]: maxGuests };
    if (minPrice) where.basePrice = { [Op.gte]: minPrice };
    if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };
    if (hasKitchen !== undefined) where.hasKitchen = hasKitchen === "true";
    if (hasPoolAccess !== undefined)
      where.hasPoolAccess = hasPoolAccess === "true";

    // Search functionality
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
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

    const { count, rows: homestays } = await HomeStay.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: homestays,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching homestays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestays",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get homestay by ID
exports.getHomeStayById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const homestay = await verifyOwnership(req.params.id, req.user.id);

    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [
          ["isFeatured", "DESC"],
          ["sortOrder", "ASC"],
        ],
      },
    ];

    const fullHomeStay = await HomeStay.findByPk(homestay.id, {
      include,
      paranoid: req.query.includeDeleted === "true",
    });

    return res.status(200).json({
      success: true,
      data: fullHomeStay,
    });
  } catch (error) {
    console.error("Error fetching homestay:", error);
    return res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to fetch homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update homestay
exports.updateHomeStay = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const homestay = await verifyOwnership(req.params.id, req.user.id);
    const { amenities, images, ...updateData } = req.body;

    // Update basic info
    await homestay.update(updateData);

    // Handle amenities if provided
    if (amenities) {
      await homestay.setAmenities([]);
      if (amenities.length > 0) {
        await homestay.addAmenities(amenities);
      }
    }

    // Handle image uploads if provided
    if (req.files?.images?.length > 0) {
      const newImages = await handleImageUploads(req.files, homestay.id);
      if (newImages.length > 0) {
        await HomeStayImage.bulkCreate(newImages);
      }
    }

    // Handle image updates if provided in body
    if (images && Array.isArray(images)) {
      const updatePromises = images
        .filter((img) => img.id)
        .map((img) => HomeStayImage.update(img, { where: { id: img.id } }));

      await Promise.all(updatePromises);
    }

    // Get the updated homestay with associations
    const updatedHomeStay = await HomeStay.findByPk(homestay.id, {
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [
            ["isFeatured", "DESC"],
            ["sortOrder", "ASC"],
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Homestay updated successfully",
      data: updatedHomeStay,
    });
  } catch (error) {
    console.error("Error updating homestay:", error);
    return res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to update homestay",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* soft-delete homestay */
exports.deleteHomestay = async (req, res) => {};

/* ################################################### customer page ######################################################### */

/* get all homestays for listing */
exports.getAllHomeStaysForListing = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      page = 1,
      limit = 10,
      search,
      unitType,
      city,
      approvalStatus,
      availabilityStatus,
      merchantId,
      minGuests,
      maxGuests,
      minPrice,
      maxPrice,
      hasKitchen,
      hasPoolAccess,
      includeDeleted,
    } = req.query;

    const where = { isActive: true, approvalStatus: "approved" };
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [
          ["isFeatured", "DESC"],
          ["sortOrder", "ASC"],
        ],
      },
    ];

    // Filter conditions
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (unitType) where.unitType = unitType;
    if (city) where.city = city;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (merchantId) where.merchantId = merchantId;
    if (minGuests) where.maxGuests = { [Op.gte]: minGuests };
    if (maxGuests)
      where.maxGuests = { ...where.maxGuests, [Op.lte]: maxGuests };
    if (minPrice) where.basePrice = { [Op.gte]: minPrice };
    if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };
    if (hasKitchen !== undefined) where.hasKitchen = hasKitchen === "true";
    if (hasPoolAccess !== undefined)
      where.hasPoolAccess = hasPoolAccess === "true";

    // Search functionality
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
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

    const { count, rows: homestays } = await HomeStay.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: homestays,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching homestays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestays",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get gome stay details */
exports.getHomeStayDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { includeDeleted } = req.query;

    const homestay = await HomeStay.findOne({
      where: {
        id: req.params.id,
        isActive: true,
        approvalStatus: "approved",
      },
      include: [
        {
          model: Amenity,
          as: "amenities",
          through: { attributes: ["isAvailable", "notes"] },
        },
        {
          model: HomeStayImage,
          as: "images",
          order: [
            ["isFeatured", "DESC"],
            ["sortOrder", "ASC"],
          ],
        },
      ],
      paranoid: includeDeleted !== "true", // Use soft-deleted records only if requested
    });

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found or not approved/active",
      });
    }

    return res.status(200).json({
      success: true,
      data: homestay,
    });
  } catch (error) {
    console.error("Error fetching homestay details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestay details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ########################################## Admin ########################################################################## */

/* Update approval status for admin */
exports.updateApprovalStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { approvalStatus, rejectionReason } = req.body;

    const homestay = await HomeStay.findByPk(req.params.id);
    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    if (!approvalStatus) {
      return res.status(400).json({
        success: false,
        message: "Approval status is required",
      });
    }

    /* Validate rejection reason if status is rejected */
    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when status is rejected",
      });
    }

    const updateData = {
      approvalStatus,
      lastStatusChange: new Date(),
    };

    if (approvalStatus === "approved") {
      updateData.approvedAt = new Date();
      updateData.rejectionReason = null;
    } else if (approvalStatus === "rejected") {
      updateData.rejectionReason = rejectionReason;
    }

    await homestay.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Approval status updated successfully",
      data: homestay,
    });
  } catch (error) {
    console.error("Error updating approval status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update approval status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ######################################### admin & merchant common routes ######################################### */
exports.getAllHomeStays = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      isActive,
      vistaVerified,
      page = 1,
      limit = 10,
      search,
      unitType,
      city,
      approvalStatus,
      availabilityStatus,
      merchantId,
      minGuests,
      maxGuests,
      minPrice,
      maxPrice,
      hasKitchen,
      hasPoolAccess,
      includeDeleted,
    } = req.query;

    // Base where conditions
    const where = {};

    // If user is merchant, only show their homestays
    if (req.user.accountType === "merchant") {
      where.merchantId = req.user.merchantProfile.id;
    }
    // Admin can optionally filter by merchantId
    else if (req.user.accountType === "admin" && merchantId) {
      where.merchantId = merchantId;
    }

    // Common include for both roles
    const include = [
      /* {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [
          ["isFeatured", "DESC"],
          ["sortOrder", "ASC"],
        ],
      }, */
    ];

    // Additional includes for admin
    if (req.user.accountType === "admin") {
      include.push({
        model: MerchantProfile,
        as: "merchant",
        attributes: ["id", "businessName"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "accountType", "isActive"],
          },
        ],
      });
    }

    // Filter conditions (common for both roles)
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (vistaVerified !== undefined)
      where.vistaVerified = vistaVerified === "true";
    if (unitType) where.unitType = unitType;
    if (city) where.city = city;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (minGuests) where.maxGuests = { [Op.gte]: minGuests };
    if (maxGuests)
      where.maxGuests = { ...where.maxGuests, [Op.lte]: maxGuests };
    if (minPrice) where.basePrice = { [Op.gte]: minPrice };
    if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };
    if (hasKitchen !== undefined) where.hasKitchen = hasKitchen === "true";
    if (hasPoolAccess !== undefined)
      where.hasPoolAccess = hasPoolAccess === "true";

    // Search functionality
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
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

    const { count, rows: homestays } = await HomeStay.findAndCountAll(options);

    return res.status(200).json({
      success: true,
      data: homestays,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching homestays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestays",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get homestay by ID for both admin and merchant
 * - Admin can see any homestay
 * - Merchant can only see their own homestays
 */
exports.getHomeStayByIdForAdminAndMerchant = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const include = [
      {
        model: Amenity,
        as: "amenities",
        through: { attributes: ["isAvailable", "notes"] },
      },
      {
        model: HomeStayImage,
        as: "images",
        order: [
          ["isFeatured", "DESC"],
          ["sortOrder", "ASC"],
        ],
      },
    ];

    // Additional includes for admin
    if (req.user.accountType === "admin") {
      include.push({
        model: MerchantProfile,
        as: "merchant",
        attributes: ["id", "businessName"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "accountType", "isActive"],
          },
        ],
      });
    }

    const options = {
      where: { id: req.params.id },
      include,
      paranoid: req.query.includeDeleted === "true",
    };

    const homestay = await HomeStay.findOne(options);

    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    // If user is merchant, verify ownership
    if (req.user.accountType === "merchant") {
      const user = await User.findByPk(req.user.id, {
        include: [{ model: MerchantProfile, as: "merchantProfile" }],
      });

      if (
        !user ||
        !user.merchantProfile ||
        homestay.merchantId !== user.merchantProfile.id
      ) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this homestay",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: homestay,
    });
  } catch (error) {
    console.error("Error fetching homestay details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homestay details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
