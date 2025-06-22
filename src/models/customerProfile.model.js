const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class CustomerProfile extends Model {
  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
    });
  }
}

CustomerProfile.init(
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
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^\+?[\d\s-]+$/,
        notEmpty: true,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "customer_profiles",
    modelName: "CustomerProfile",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["userId"],
      },
      {
        fields: ["firstName", "lastName"],
      },
    ],
  }
);

module.exports = CustomerProfile;
