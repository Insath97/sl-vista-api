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

    this.hasMany(models.TransportReview, {
      foreignKey: "transportId",
      as: "reviews",
      onDelete: "CASCADE",
    });

    this.belongsToMany(models.Amenity, {
      through: models.TransportAmenity,
      foreignKey: "transportId",
      as: "amenities",
    });
  }

  async toggleVerified() {
    this.vistaVerified = !this.vistaVerified;
    return await this.save();
  }

  async getAverageRating() {
    const result = await this.sequelize.models.TransportReview.findOne({
      attributes: [
        [
          this.sequelize.fn("AVG", this.sequelize.col("rating")),
          "averageRating",
        ],
        [this.sequelize.fn("COUNT", this.sequelize.col("id")), "reviewCount"],
      ],
      where: {
        transportId: this.id,
        status: "approved",
      },
    });

    return {
      averageRating: parseFloat(result?.get("averageRating") || 0).toFixed(1),
      reviewCount: result?.get("reviewCount") || 0,
    };
  }

  async addAmenities(amenityIds) {
    return await this.sequelize.models.TransportAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        transportId: this.id,
        amenityId,
        isAvailable: true,
      }))
    );
  }

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
          {
            returning: true,
          }
        );
      return amenity;
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
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COALESCE(AVG(rating), 0)
              FROM transport_reviews
              WHERE 
                transport_reviews.transportId = Transport.id AND
                transport_reviews.status = 'approved' AND
                transport_reviews.deletedAt IS NULL
            )`),
            "averageRating",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM transport_reviews
              WHERE 
                transport_reviews.transportId = Transport.id AND
                transport_reviews.status = 'approved' AND
                transport_reviews.deletedAt IS NULL
            )`),
            "reviewCount",
          ],
        ],
      },
    },
    scopes: {
      withFullDetails: {
        include: [
          "transportType",
          "images",
          "amenities",
          {
            association: "reviews",
            where: { status: "approved" },
            required: false,
            include: ["user"],
          },
        ],
      },
      withAmenities: {
        include: ["amenities"],
      },
      withImages: {
        include: ["images"],
      },
      withReviews: {
        include: [
          {
            association: "reviews",
            where: { status: "approved" },
            required: false,
            include: ["user"],
          },
        ],
      },
      forAdmin: {
        paranoid: false,
        include: [
          "transportType",
          "images",
          "amenities",
          {
            association: "reviews",
            required: false,
            include: ["user"],
          },
        ],
      },
    },
    hooks: {
    /*   beforeValidate: (transport) => {
        if (!transport.title) {
          throw new Error('Title is required for slug generation');
        }
        
        if (transport.changed("title") || !transport.slug) {
          transport.slug = slugify(transport.title.toString(), { // Ensure title is string
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      }, */
    }
  }
);

module.exports = Transport;
