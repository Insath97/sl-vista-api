// models/Permission.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Permission extends Model {}

Permission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      comment:
        "Grouping category for permissions (e.g., 'users', 'properties')",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: "Permission",
    tableName: "permissions",
    timestamps: true,
    paranoid: true,
  }
);

module.exports = Permission;
