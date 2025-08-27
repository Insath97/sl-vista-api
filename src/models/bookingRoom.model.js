const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class BookingRoom extends Model {
  static associate(models) {
    this.belongsTo(models.Booking, {
      foreignKey: "bookingId",
      as: "booking",
      onDelete: "CASCADE",
    });

    this.belongsTo(models.Room, {
      foreignKey: "roomId",
      as: "room",
      onDelete: "CASCADE",
    });
  }
}

BookingRoom.init(
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
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "rooms",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "BookingRoom",
    tableName: "booking_rooms",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["bookingId", "roomId"],
      },
    ],
  }
);

module.exports = BookingRoom;
