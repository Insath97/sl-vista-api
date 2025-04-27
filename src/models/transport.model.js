const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Transport extends Model {
  static associate(models) {
    this.belongsTo(models.TransportType, {
      foreignKey: "transportTypeId",
      as: "transportType",
    });

    this.hasMany(models.TransportImage, {
      foreignKey: "transportId",
      as: "images",
      onDelete: "CASCADE",
    });

    // Updated belongsToMany association
    this.belongsToMany(models.Amenity, {
      through: {
        model: models.TransportAmenity,
        unique: false,
      },
      foreignKey: "transportId", // Explicit foreign key
      otherKey: "amenityId", // Explicit other key
      as: "amenities",
      onDelete: "CASCADE",
    });
  }

  async toggleVerified() {
    this.vistaVerified = !this.vistaVerified;
    return await this.save();
  }
}

Transport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    transportTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "transport_types",
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Title cannot be empty" },
        len: { args: [2, 100], msg: "Title must be 2-100 characters" },
      },
      set(value) {
        this.setDataValue("title", value.trim());
        if (!this.slug) {
          this.slug = slugify(value, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "This slug is already in use" },
      validate: {
        is: { args: /^[a-z0-9-]+$/, msg: "Invalid slug format" },
        notEmpty: true,
      },
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    operatorName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Operator name cannot be empty" },
      },
    },
    pricePerKmUSD: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: { args: [0], msg: "Price cannot be negative" },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number is required" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      validate: {
        isEmail: { msg: "Invalid email format" },
      },
    },
    website: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: { msg: "Invalid website URL" },
      },
    },
    description: {
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue("description", value?.trim() || null);
      },
    },
    departureCity: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Departure city is required" },
      },
    },
    arrivalCity: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Arrival city is required" },
      },
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: { args: [-90], msg: "Invalid latitude" },
        max: { args: [90], msg: "Invalid latitude" },
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: { args: [-180], msg: "Invalid longitude" },
        max: { args: [180], msg: "Invalid longitude" },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "transports",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    scopes: {
      withInactive: { where: {} },
      forAdmin: { paranoid: false },
      withImages: { include: ["images"] },
      withTransportType: { include: ["transportType"] },
    },
    hooks: {
      beforeValidate: (transport) => {
        if (transport.changed("title") || !transport.slug) {
          transport.slug = slugify(transport.title, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Transport;
