const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Booking extends Model {
  static associate(models) {
    // Customer association
    this.belongsTo(models.CustomerProfile, {
      foreignKey: "customerId",
      as: "customer",
    });

    // Many-to-many with Rooms through BookingRoom
    this.belongsToMany(models.Room, {
      through: models.BookingRoom,
      foreignKey: "bookingId",
      as: "rooms",
    });

    // Many-to-many with HomeStays through BookingHomeStay
    this.belongsToMany(models.HomeStay, {
      through: models.BookingHomeStay,
      foreignKey: "bookingId",
      as: "homestays",
    });

    // Direct associations with the junction tables
    this.hasMany(models.BookingRoom, {
      foreignKey: "bookingId",
      as: "bookingRooms",
    });

    this.hasMany(models.BookingHomeStay, {
      foreignKey: "bookingId",
      as: "bookingHomeStays",
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
      validate: {
        isDate: true,
        notEmpty: true,
      },
    },
    checkOutDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true,
        isAfterCheckIn(value) {
          if (new Date(value) <= new Date(this.checkInDate)) {
            throw new Error("Check-out date must be after check-in date");
          }
        },
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
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
      type: DataTypes.ENUM(
        "pending",
        "paid",
        "partially_paid",
        "refunded",
        "failed"
      ),
      defaultValue: "pending",
    },
    paymentMethod: {
      type: DataTypes.ENUM(
        "credit_card",
        "debit_card",
        "bank_transfer",
        "cash",
        "wallet"
      ),
      allowNull: true,
    },
    specialRequests: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isRefundable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    refundAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    numberOfGuests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    numberOfChildren: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    numberOfInfants: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
        // Update availability when booking is created
        await booking.updateAvailability("unavailable");
      },
      afterUpdate: async (booking) => {
        // Update availability when booking status changes
        if (booking.changed("bookingStatus")) {
          if (["completed", "cancelled"].includes(booking.bookingStatus)) {
            await booking.updateAvailability("available");
          } else if (booking.bookingStatus === "confirmed") {
            await booking.updateAvailability("booked");
          }
        }
      },
    },
  }
);

// Instance method to update availability of booked items
Booking.prototype.updateAvailability = async function (status) {
  const booking = await Booking.findByPk(this.id, {
    include: [
      { model: this.sequelize.models.Room, as: "rooms" },
      { model: this.sequelize.models.HomeStay, as: "homestays" },
    ],
  });

  // Update rooms availability
  if (booking.rooms && booking.rooms.length > 0) {
    await Promise.all(
      booking.rooms.map((room) => room.update({ availabilityStatus: status }))
    );
  }

  // Update homestays availability
  if (booking.homestays && booking.homestays.length > 0) {
    await Promise.all(
      booking.homestays.map((homestay) =>
        homestay.update({ availabilityStatus: status })
      )
    );
  }
};

module.exports = Booking;
