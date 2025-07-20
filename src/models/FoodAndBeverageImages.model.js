const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class FoodAndBeveragesImage extends Model {}

FoodAndBeveragesImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    foodAndBeverageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "food_and_beverages",
        key: "id",
      },
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    s3Key: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,

    tableName: "food_and_beverages_images",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      order: [["sortOrder", "ASC"]],
    },
  }
);

module.exports = FoodAndBeveragesImage;
