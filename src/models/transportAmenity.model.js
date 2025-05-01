const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportAmenity extends Model {}

TransportAmenity.init(
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
    amenityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "amenities",
        key: "id",
      },
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "transport_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["transportId", "amenityId"],
      },
    ],
  }
);

module.exports = TransportAmenity;
