// validations/activity.validation.js
const { body, param, query } = require("express-validator");
const Activity = require("../../models/activity.model");

const LANGUAGES = ["en", "ar", "fr"];
const MAX_IMAGES = 10;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Shared Validators
const titleValidator = body("title")
  .trim()
  .notEmpty()
  .withMessage("Title is required")
  .isLength({ min: 2, max: 100 })
  .withMessage("Title must be between 2-100 characters")
  .custom(async (value, { req }) => {
    if (
      req.method === "POST" ||
      (req.method === "PUT" && req.body.title !== req.activity?.title)
    ) {
      const exists = await Activity.findOne({ where: { title: value } });
      if (exists) throw new Error("Activity with this title already exists");
    }
    return true;
  });

const locationValidator = [
  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City name too long"),

  body("province")
    .trim()
    .notEmpty()
    .withMessage("Province is required")
    .isLength({ max: 100 })
    .withMessage("Province name too long"),

  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude (-90 to 90)"),

  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude (-180 to 180)"),
];

const imageValidator = (req, res, next) => {
  if (!req.files) return next();

  // Check number of files
  if (req.files.length > MAX_IMAGES) {
    return res.status(400).json({
      success: false,
      message: `Maximum ${MAX_IMAGES} images allowed`,
    });
  }

  // Check file types
  const invalidFiles = req.files.filter(
    (file) => !ALLOWED_IMAGE_TYPES.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Only JPEG, PNG, GIF, or WEBP images are allowed",
    });
  }

  next();
};

// Export Validators
module.exports = {
  create: [
    titleValidator,
    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description too long (max 2000 chars)"),

    ...locationValidator,

    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number")
      .toFloat(),

    body("language_code")
      .optional()
      .isIn(LANGUAGES)
      .withMessage(`Language must be one of: ${LANGUAGES.join(", ")}`),

    imageValidator,
  ],

  update: [
    param("id")
      .isInt()
      .withMessage("Invalid activity ID")
      .custom(async (value, { req }) => {
        const activity = await Activity.findByPk(value);
        if (!activity) throw new Error("Activity not found");
        req.activity = activity; // Attach to request for reuse
        return true;
      }),

    titleValidator.optional(),
    body("description").optional().trim().isLength({ max: 2000 }),
    ...locationValidator.map((v) => v.optional()),
    body("price").optional().isFloat({ min: 0 }).toFloat(),
    body("language_code").optional().isIn(LANGUAGES),
    body("isActive").optional().isBoolean(),
    imageValidator,
  ],

  getById: [
    param("id")
      .isInt()
      .withMessage("Invalid activity ID")
      .custom(async (value, { req }) => {
        const activity = await Activity.findOne({
          where: { id: value },
          paranoid: req.query.includeDeleted === "true" ? false : true,
        });
        if (!activity) throw new Error("Activity not found");
        return true;
      }),
  ],

  delete: [
    param("id")
      .isInt()
      .withMessage("Invalid activity ID")
      .custom(async (value) => {
        const exists = await Activity.findByPk(value);
        if (!exists) throw new Error("Activity not found");
        return true;
      }),
  ],

  restore: [
    param("id")
      .isInt()
      .withMessage("Invalid activity ID")
      .custom(async (value) => {
        const activity = await Activity.findOne({
          where: { id: value },
          paranoid: false,
        });
        if (!activity) throw new Error("Activity not found in deleted records");
        if (!activity.deletedAt) throw new Error("Activity is not deleted");
        return true;
      }),
  ],

  toggleStatus: [
    param("id")
      .isInt()
      .withMessage("Invalid activity ID")
      .custom(async (value) => {
        const exists = await Activity.findByPk(value);
        if (!exists) throw new Error("Activity not found");
        return true;
      }),
  ],

  list: [
    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be boolean")
      .toBoolean(),

    query("city").optional().trim().isLength({ max: 100 }),

    query("search")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Search query too long"),

    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be boolean")
      .toBoolean(),
  ],
};
