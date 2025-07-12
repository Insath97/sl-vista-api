const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Role extends Model {
  static associate(models) {
    this.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: "roleId",
      as: "users",
    });

    this.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: "roleId",
      as: "permissions",
    });
  }
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    modelName: "Role",
    tableName: "roles",
    timestamps: true,
    paranoid: true,
  }
);

module.exports = Role;
