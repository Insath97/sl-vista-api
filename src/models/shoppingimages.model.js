const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class ShoppingImages extends Model {
 
}

ShoppingImages.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shoppingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "shoppings",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      validate: {
        isUrl: { msg: "Invalid URL format" },
        notEmpty: { msg: "Image URL cannot be empty" },
      },
    },
    s3Key: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      set(value) {
        if (value) this.setDataValue("fileName", value.trim());
      },
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: { msg: "Size must be an integer" },
      },
    },
    mimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
      set(value) {
        if (value) this.setDataValue("mimetype", value.trim());
      },
    },
    caption: {
      type: DataTypes.STRING(255),
      allowNull: true,
      set(value) {
        if (value) this.setDataValue("caption", value.trim());
      },
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isInt: { msg: "Sort order must be an integer" },
      },
    },
  },
  {
    sequelize,
    tableName: "shoppings_images",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      order: [["sortOrder", "ASC"]],
    },
  }
);

module.exports = ShoppingImages;
