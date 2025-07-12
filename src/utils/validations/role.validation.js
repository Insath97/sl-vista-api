const { body } = require("express-validator");
const Permission = require("../../models/permisson.model");
const Role = require("../../models/role.model");

exports.createRoleValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Role name is required")
    .isLength({ max: 50 })
    .withMessage("Role name must be less than 50 characters")
    .custom(async (value) => {
      const role = await Role.findOne({ where: { name: value } });
      if (role) throw new Error("Role name already exists");
    }),

  body("userType").isIn(["admin", "merchant"]).withMessage("Invalid user type"),

  body("permissionIds")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array of IDs")
    .custom(async (value, { req }) => {
      if (value && value.length) {
        const permissions = await Permission.findAll({
          where: {
            id: value,
            userType: req.body.userType,
          },
        });
        if (permissions.length !== value.length) {
          throw new Error(
            "Some permissions are invalid or not allowed for this user type"
          );
        }
      }
    }),
];

exports.assignRoleValidation = [
  body("userId")
    .isInt()
    .withMessage("Invalid user ID")
    .custom(async (value) => {
      const user = await User.findByPk(value);
      if (!user) throw new Error("User not found");
    }),

  body("roleId")
    .isInt()
    .withMessage("Invalid role ID")
    .custom(async (value) => {
      const role = await Role.findByPk(value);
      if (!role) throw new Error("Role not found");
    }),
];
