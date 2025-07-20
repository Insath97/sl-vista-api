const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Role = require("../../models/role.model");
const Permission = require("../../models/permisson.model");
const User = require("../../models/user.model");

// Common validation rules
const idParam = param("id")
  .isInt()
  .withMessage("Invalid ID format")
  .custom(async (value, { req }) => {
    const role = await Role.findOne({
      where: { id: value },
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });
    if (!role) throw new Error("Role not found");

    // Authorization checks
    if (role.userType === "system" && req.user.accountType !== "admin") {
      throw new Error("Unauthorized to access this role");
    }
    if (
      role.userType === "admin" &&
      !["admin", "system"].includes(req.user.accountType)
    ) {
      throw new Error("Unauthorized to access this role");
    }
    if (role.userType === "merchant" && req.user.accountType === "customer") {
      throw new Error("Unauthorized to access this role");
    }
    return true;
  });

const validateName = body("name")
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage("Name must be 2-50 characters")
  .custom(async (value, { req }) => {
    const where = {
      name: value,
      [Op.not]: { id: req.params?.id || 0 },
    };
    const exists = await Role.findOne({ where, paranoid: false });
    if (exists) throw new Error("Role name already exists");
    return true;
  });

const validateDescription = body("description")
  .optional()
  .trim()
  .isLength({ max: 255 })
  .withMessage("Description must be less than 255 characters");

const validateUserType = body("userType")
  .isIn(["system", "admin", "merchant"])
  .withMessage("Invalid user type")
  .custom(async (value, { req }) => {
    if (value === "system" && req.user.accountType !== "admin") {
      throw new Error("Only system admins can create system roles");
    }
    if (
      value === "admin" &&
      !["admin", "system"].includes(req.user.accountType)
    ) {
      throw new Error("Only admins can create admin roles");
    }
    return true;
  });

const validatePermissionIds = body("permissionIds")
  .optional()
  .isArray()
  .withMessage("Permissions must be an array of IDs")
  .custom(async (value, { req }) => {
    if (value && value.length) {
      const userType =
        req.body.userType ||
        (req.params.id ? (await Role.findByPk(req.params.id)).userType : null);

      if (!userType) {
        throw new Error("User type is required to validate permissions");
      }

      const permissions = await Permission.findAll({
        where: {
          id: value,
          userType,
        },
      });
      if (permissions.length !== value.length) {
        throw new Error(
          "Some permissions are invalid or not allowed for this role type"
        );
      }
    }
    return true;
  });

// Enhanced update validation with permission check
const updateValidation = [
  idParam,
  validateName.optional(),
  validateDescription,
  validatePermissionIds,
  body().custom(async (value, { req }) => {
    // Check if user has permission to update roles
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: "roles",
          include: [{ model: Permission, as: "permissions" }],
        },
      ],
    });

    const hasPermission = user.roles.some((role) =>
      role.permissions.some((perm) => perm.name === "update_roles")
    );

    if (!hasPermission) {
      throw new Error("You don't have permission to update roles");
    }
    return true;
  }),
];

// Enhanced restore validation
const restoreValidation = [
  idParam,
  body().custom(async (value, { req }) => {
    const role = await Role.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!role) {
      throw new Error("Role not found (including soft-deleted)");
    }

    if (!role.deletedAt) {
      throw new Error("Role is not deleted");
    }

    // Check if name is still available
    const existingRole = await Role.findOne({
      where: {
        name: role.name,
        id: { [Op.ne]: role.id },
      },
      paranoid: false,
    });

    if (existingRole) {
      throw new Error(
        "Cannot restore role - a role with this name already exists"
      );
    }
    return true;
  }),
];

// Query validations
const queryValidations = [
  query("userType")
    .optional()
    .isIn(["system", "admin", "merchant"])
    .withMessage("Invalid user type"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),

  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean"),

  query("includePermissions")
    .optional()
    .isBoolean()
    .withMessage("includePermissions must be a boolean"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

module.exports = {
  // Create Role
  create: [
    validateName,
    validateDescription,
    validateUserType,
    validatePermissionIds,
  ],

  // List Roles
  list: queryValidations,

  // Get by ID
  getById: [
    idParam,
    query("includeDeleted")
      .optional()
      .isBoolean()
      .withMessage("includeDeleted must be a boolean"),
    query("includePermissions")
      .optional()
      .isBoolean()
      .withMessage("includePermissions must be a boolean"),
  ],

  // Update Role (with permission check)
  update: updateValidation,

  // Delete Role
  delete: [idParam],

  // Restore Role (with name conflict check)
  restore: restoreValidation,
};
