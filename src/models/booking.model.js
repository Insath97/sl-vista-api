const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Booking extends Model {
  static associate(models) {
    /* HomeStay Association */
    this.belongsTo(models.HomeStay, {
      foreignKey: "homestayId",
      as: "homestay",
    });

    /* Customer Association */
    this.belongsTo(models.CustomerProfile, {
      foreignKey: "customerId",
      as: "customer",
    });
  }
}

Booking.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    homestayId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "home_stays",
        key: "id",
      },
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customer_profiles",
        key: "id",
      },
    },
    checkInDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    checkOutDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    bookingStatus: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "failed"
      ),
      defaultValue: "pending",
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "paid", "refunded", "failed"),
      defaultValue: "pending",
    },
  },
  {
    sequelize,
    modelName: "Booking",
    tableName: "bookings",
    timestamps: true,
    paranoid: true,
    hooks: {
      afterCreate: async (booking) => {
        // Update homestay status when booking is created
        await booking.getHomestay().then((homestay) => {
          homestay.update({ availabilityStatus: "unavailable" });
        });
      },
      afterUpdate: async (booking) => {
        // Update homestay status when booking is completed or cancelled
        if (
          booking.changed("bookingStatus") &&
          ["completed", "cancelled"].includes(booking.bookingStatus)
        ) {
          await booking.getHomestay().then((homestay) => {
            homestay.update({ availabilityStatus: "available" });
          });
        }
      },
    },
  }
);

module.exports = Booking;
