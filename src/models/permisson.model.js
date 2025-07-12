// models/Permission.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Permission extends Model {
  static associate(models) {
    this.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: "permissionId",
      as: "roles",
    });
  }
}

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
    userType: {
      type: DataTypes.ENUM("admin", "merchant"),
      allowNull: false,
      defaultValue: "admin",
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
