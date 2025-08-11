const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Property extends Model {
  static associate(models) {
    this.belongsTo(models.MerchantProfile, {
      foreignKey: "merchantId",
      as: "merchant",
      onDelete: "CASCADE",
    });

    this.hasMany(models.PropertyImage, {
      foreignKey: "propertyId",
      as: "images",
      onDelete: "CASCADE",
    });

    this.belongsToMany(models.Amenity, {
      through: models.PropertyAmenity,
      foreignKey: "propertyId",
      as: "amenities",
    });

    this.hasMany(models.PropertyAmenity, {
      foreignKey: "propertyId",
      as: "propertyAmenities",
    });

    this.hasMany(models.Room, {
      foreignKey: "propertyId",
      as: "rooms",
    });
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.PropertyImage.bulkCreate(
      images.map((image) => ({
        propertyId: this.id,
        ...image,
      }))
    );
  }

  async addAmenities(amenityIds, options = {}) {
    return await this.sequelize.models.PropertyAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        propertyId: this.id,
        amenityId,
        ...options,
      })),
      { returning: true }
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.PropertyImage.findOne({
          where: { id: update.id, propertyId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.PropertyImage.create({
          propertyId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  async updateAmenities(amenityUpdates) {
    await this.sequelize.models.PropertyAmenity.destroy({
      where: { propertyId: this.id },
    });
    return this.addAmenities(amenityUpdates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.PropertyImage.update(
      { isFeatured: false },
      { where: { propertyId: this.id } }
    );

    const image = await this.sequelize.models.PropertyImage.findOne({
      where: { id: imageId, propertyId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }

  async toggleAmenityAvailability(amenityId) {
    const propertyAmenity = await this.sequelize.models.PropertyAmenity.findOne(
      {
        where: { propertyId: this.id, amenityId },
      }
    );

    if (!propertyAmenity) {
      throw new Error("Amenity not found for this property");
    }

    propertyAmenity.isAvailable = !propertyAmenity.isAvailable;
    return await propertyAmenity.save();
  }
}

Property.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    merchantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "merchant_profiles",
        key: "id",
      },
    },
    propertyType: {
      type: DataTypes.ENUM("hotel", "homestay", "apartment", "resort", "villa"),
      allowNull: false,
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
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Address is required" },
        len: {
          args: [10, 255],
          msg: "Address must be between 10 and 255 characters",
        },
      },
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Sri Lanka",
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    cancellationPolicy: {
      type: DataTypes.ENUM("flexible", "moderate", "strict", "non_refundable"),
      allowNull: false,
      defaultValue: "moderate",
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: -180,
        max: 180,
      },
    },
    checkInTime: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: "14:00",
    },
    checkOutTime: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: "12:00",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
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
    facebookUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    instagramUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    availabilityStatus: {
      type: DataTypes.ENUM(
        "available",
        "unavailable",
        "maintenance",
        "archived"
      ),
      allowNull: false,
      defaultValue: "available",
    },
    approvalStatus: {
      type: DataTypes.ENUM(
        "pending",
        "approved",
        "rejected",
        "changes_requested"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        notEmpty: {
          msg: "Rejection reason is required when status is rejected",
          args: function () {
            return this.approvalStatus === "rejected";
          },
        },
      },
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastStatusChange: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Property",
    tableName: "properties",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: {  },
    },
    scopes: {
      inactive: {
        where: { isActive: false },
      },
      approved: {
        where: { approvalStatus: "approved" },
      },
      pending: {
        where: { approvalStatus: "pending" },
      },
      available: {
        where: { availabilityStatus: "available" },
      },
    },
    hooks: {
      beforeUpdate: (property) => {
        if (
          property.changed("approvalStatus") ||
          property.changed("availabilityStatus")
        ) {
          property.lastStatusChange = new Date();
        }

        if (
          property.changed("approvalStatus") &&
          property.approvalStatus === "approved"
        ) {
          property.approvedAt = new Date();
        }
      },
      beforeValidate: (property) => {
        if (property.changed("title") || !property.slug) {
          property.slug = slugify(property.title || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Property;
