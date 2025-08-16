const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class BookingHomeStay extends Model {}

BookingHomeStay.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "bookings",
        key: "id",
      },
    },
    homestayId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "home_stays",
        key: "id",
      },
    },
    specialRequests: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "BookingHomeStay",
    tableName: "booking_homestays",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["bookingId", "homestayId"],
      },
    ],
  }
);

module.exports = BookingHomeStay;
