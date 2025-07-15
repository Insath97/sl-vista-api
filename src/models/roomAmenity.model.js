// models/RoomAmenity.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class RoomAmenity extends Model {}

RoomAmenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "rooms",
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
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "room_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["roomId", "amenityId"],
      },
      {
        fields: ["amenityId"],
      },
    ],
  }
);

module.exports = RoomAmenity;