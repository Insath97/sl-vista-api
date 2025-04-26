const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportImage extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      as: "transport",
    });
  }
}

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
    imagePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Image path is required" },
      },
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    caption: {
      type: DataTypes.STRING(100),
    },
  },
  {
    sequelize,
    tableName: "transport_images",
    timestamps: true,
  }
);

module.exports = TransportImage;
