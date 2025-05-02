const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportImage extends Model {}

TransportImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "transports",
        key: "id",
      },
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      validate: {
        isUrl: true,
        notEmpty: true,
      },
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
    mimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    caption: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "transport_images",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      order: [["sortOrder", "ASC"]],
    },
  }
);

module.exports = TransportImage;