const { DataTypes, Model, Op } = require("sequelize");
const { sequelize } = require("../config/database");

class Booking extends Model {
  static associate(models) {
    // Customer association
    this.belongsTo(models.CustomerProfile, {
      foreignKey: "customerId",
      as: "customer",
    });

    // Rooms association
    this.belongsToMany(models.Room, {
      through: models.BookingRoom,
      foreignKey: "bookingId",
      otherKey: "roomId",
      as: "rooms",
    });

    // Homestays association
    this.belongsToMany(models.HomeStay, {
      through: models.BookingHomeStay,
      foreignKey: "bookingId",
      otherKey: "homestayId",
      as: "homestays",
    });

    // Direct associations with junction tables
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
        isAfterToday(value) {
          if (new Date(value) <= new Date().setHours(0, 0, 0, 0)) {
            throw new Error("Check-in date must be in the future");
          }
        },
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
    subTotalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isDecimal: {
          msg: "Subtotal must be a valid decimal number",
        },
        min: {
          args: [0],
          msg: "Subtotal cannot be negative",
        },
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isDecimal: {
          msg: "Total amount must be a valid decimal number",
        },
        min: {
          args: [0],
          msg: "Total amount cannot be negative",
        },
      },
    },
    bookingType: {
      type: DataTypes.ENUM("room", "homestay", "mixed"),
      allowNull: true,
      validate: {
        notEmpty: {
          msg: "Booking type is required",
        },
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
    defaultScope: {
      where: {},
    },
    hooks: {
      beforeValidate: (booking) => {
        // Auto-determine booking type based on associated rooms/homestays
        if (
          booking.bookingType === null &&
          (booking.rooms || booking.homestays)
        ) {
          const hasRooms = booking.rooms && booking.rooms.length > 0;
          const hasHomestays =
            booking.homestays && booking.homestays.length > 0;

          if (hasRooms && hasHomestays) {
            booking.bookingType = "mixed";
          } else if (hasRooms) {
            booking.bookingType = "room";
          } else if (hasHomestays) {
            booking.bookingType = "homestay";
          }
        }
      },
    },
  }
);

module.exports = Booking;
