const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Transport extends Model {
  static associate(models) {
    this.belongsTo(models.TransportType, {
      foreignKey: "transportTypeId",
      as: "transportType",
    });

    this.belongsToMany(models.Amenity, {
      through: models.TransportAmenity,
      foreignKey: "transportId",
      otherKey: "amenityId",
      as: "amenities",
    });

    this.hasMany(models.TransportImage, {
      foreignKey: "transportId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add amenities
  async addAmenities(amenityIds) {
    return await this.sequelize.models.TransportAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        transportId: this.id,
        amenityId,
        isAvailable: true,
      }))
    );
  }

  // Helper method to update amenities
  async updateAmenities(amenityUpdates) {
    const updates = amenityUpdates.map(async (update) => {
      const [amenity, created] =
        await this.sequelize.models.TransportAmenity.upsert(
          {
            transportId: this.id,
            amenityId: update.amenityId,
            isAvailable: update.isAvailable,
            notes: update.notes,
          },
          { returning: true }
        );
      return amenity;
    });
    return Promise.all(updates);
  }

  async addImages(images) {
    return await this.sequelize.models.TransportImage.bulkCreate(
      images.map((image) => ({
        transportId: this.id,
        ...image,
      }))
    );
  }

  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        // Update existing image
        const image = await this.sequelize.models.TransportImage.findOne({
          where: { id: update.id, transportId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        // Create new image
        return await this.sequelize.models.TransportImage.create({
          transportId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
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
      allowNull: false,
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
    seatCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: "Seat count must be at least 1" },
        isInt: { msg: "Seat count must be an integer" },
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
      allowNull: true,
      validate: {
        isEmail: { msg: "Invalid email format" },
      },
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: { msg: "Invalid website URL" },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
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
  }
);

module.exports = Transport;
