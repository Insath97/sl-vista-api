const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class PropertySetting extends Model {
  static associate(models) {
    this.belongsTo(models.Property, {
      foreignKey: "propertyId",
      as: "property",
      onDelete: "CASCADE"
    });
  }
}

PropertySetting.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "properties",
        key: "id"
      }
    },
    // Unit management
    maxUnits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 1
      }
    },
    currentUnits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    // Booking settings
    minStayDuration: {
      type: DataTypes.INTEGER, // in nights
      allowNull: false,
      defaultValue: 1
    },
    maxStayDuration: {
      type: DataTypes.INTEGER, // in nights
      allowNull: true
    },
    advanceBookingPeriod: {
      type: DataTypes.INTEGER, // in days
      allowNull: false,
      defaultValue: 365
    },
    // Cancellation
    cancellationWindow: {
      type: DataTypes.INTEGER, // in hours
      allowNull: false,
      defaultValue: 48
    },
    // Pricing
    dynamicPricingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    seasonalPricingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Notifications
    newBookingAlert: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    maintenanceAlerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Other operational settings
    checkInBuffer: {
      type: DataTypes.INTEGER, // in minutes
      defaultValue: 30,
      comment: "Time needed between check-out and next check-in"
    },
    autoApproveBookings: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: "property_settings",
    timestamps: true,
    paranoid: true,
  }
);

module.exports = PropertySetting;