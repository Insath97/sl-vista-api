/* junction table for role and permission */
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class RolePermission extends Model {}

RolePermission.init(
  {
    roleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: "roles",
        key: "id",
      },
    },
    permissionId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: "permissions",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "RolePermission",
    tableName: "role_permissions",
    timestamps: false,
  }
);

module.exports = RolePermission;