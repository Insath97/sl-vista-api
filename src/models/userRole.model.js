/* junction table for user and role */
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class UserRole extends Model {}

UserRole.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    roleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: "roles",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "UserRole",
    tableName: "user_roles",
    timestamps: false,
  }
);

module.exports = UserRole;