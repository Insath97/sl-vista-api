const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class AdminProfile extends Model {
  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
    });
  }

  toJSON() {
    const values = { ...super.toJSON() };
    return values;
  }
}

AdminProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^\+?[\d\s-]+$/, // Basic phone validation
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "AdminProfile",
    tableName: "admin_profiles",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["userId"],
      },
    ],
  }
);

module.exports = AdminProfile;
