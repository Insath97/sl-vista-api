const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class MerchantProfile extends Model {
  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
    });

    this.hasMany(models.Property, {
      foreignKey: "merchantId",
      as: "properties",
      onDelete: "CASCADE",
    });

    this.hasMany(models.HomeStay, {
      foreignKey: "merchantId",
      as: "homestays",
      onDelete: "CASCADE",
    });
  }
}

MerchantProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    merchantName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    businessName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    businessRegistrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    businessType: {
      type: DataTypes.ENUM("hotel_and_appartment", "homestay", "both", "other"),
      allowNull: false,
    },
    allowedPropertyTypes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    businessDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isSriLankan: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    nicNumber: {
      type: DataTypes.STRING(20),
      allowNull: function () {
        return !this.isSriLankan;
      },
      validate: {
        isSriLankanNic: function (value) {
          if (this.isSriLankan && !value) {
            throw new Error("NIC is required for Sri Lankan citizens");
          }
          if (value && this.isSriLankan) {
            const nicRegex = /^([0-9]{9}[vVxX]|[0-9]{12})$/;
            if (!nicRegex.test(value)) {
              throw new Error(
                "Invalid NIC format. Use 123456789V or 123456789012"
              );
            }
          }
        },
      },
    },
    passportNumber: {
      type: DataTypes.STRING(50),
      allowNull: function () {
        return this.isSriLankan;
      },
      validate: {
        isPassportNumber: function (value) {
          if (!this.isSriLankan && !value) {
            throw new Error("Passport is required for foreign merchants");
          }
        },
      },
    },
    address: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Sri Lanka",
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^\+?[\d\s-]{10,15}$/,
      },
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "active",
        "inactive",
        "suspended",
        "rejected"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    maxPropertiesAllowed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 0,
        max: 100,
      },
    },
    verificationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    suspensionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "MerchantProfile",
    tableName: "merchant_profiles",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["userId"],
      },
      {
        fields: ["nicNumber"],
        unique: true,
      },
      {
        fields: ["passportNumber"],
        unique: true,
      },
      {
        fields: ["status"],
      },
      {
        fields: ["businessName"],
      },
    ],
  }
);

module.exports = MerchantProfile;