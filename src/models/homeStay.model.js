const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class HomeStay extends Model {
  static associate(models) {
    /* associations with merchant profile */
    this.belongsTo(models.MerchantProfile, {
      foreignKey: "merchantId",
      as: "merchant",
      onDelete: "CASCADE",
    });

    /* associations with images */
    this.hasMany(models.HomeStayImage, {
      foreignKey: "homestayId",
      as: "images",
      onDelete: "CASCADE",
    });

    /* associations with amenities */
    this.belongsToMany(models.Amenity, {
      through: models.HomeStayAmenity,
      foreignKey: "homestayId",
      as: "amenities",
      onDelete: "CASCADE",
    });

    /* associations with bookings */
    this.hasMany(models.Booking, {
      foreignKey: "homestayId",
      as: "bookings",
      onDelete: "CASCADE",
    });
  }

  // Add images to homestay
  async addImages(images) {
    return await this.sequelize.models.HomeStayImage.bulkCreate(
      images.map((image) => ({
        homestayId: this.id,
        ...image,
      }))
    );
  }

  // Add amenities to homestay
  async addAmenities(amenityIds, options = {}) {
    return await this.sequelize.models.HomeStayAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        homestayId: this.id,
        amenityId,
        ...options,
      })),
      { returning: true }
    );
  }

  // Update homestay images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.HomeStayImage.findOne({
          where: { id: update.id, homestayId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.HomeStayImage.create({
          homestayId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  // Update homestay amenities
  async updateAmenities(amenityUpdates) {
    await this.sequelize.models.HomeStayAmenity.destroy({
      where: { homestayId: this.id },
    });
    return this.addAmenities(amenityUpdates);
  }

  // Set featured image for homestay
  async setFeaturedImage(imageId) {
    await this.sequelize.models.HomeStayImage.update(
      { isFeatured: false },
      { where: { homestayId: this.id } }
    );

    const image = await this.sequelize.models.HomeStayImage.findOne({
      where: { id: imageId, homestayId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }

  // Toggle amenity availability
  async toggleAmenityAvailability(amenityId) {
    const homestayAmenity = await this.sequelize.models.HomeStayAmenity.findOne(
      {
        where: { homestayId: this.id, amenityId },
      }
    );

    if (!homestayAmenity) {
      throw new Error("Amenity not found for this homestay");
    }

    homestayAmenity.isAvailable = !homestayAmenity.isAvailable;
    return await homestayAmenity.save();
  }
}

HomeStay.init(
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
      references: {
        model: "merchant_profiles",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unitType: {
      type: DataTypes.ENUM(
        "entire_home",
        "private_room",
        "shared_room",
        "guest_suite",
        "villa",
        "cottage"
      ),
      allowNull: false,
      defaultValue: "private_room",
    },
    maxGuests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 1,
        max: 20,
      },
    },
    maxChildren: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxInfants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bedroomCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    bathroomCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    attachedBathrooms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sharedBathrooms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bathroomType: {
      type: DataTypes.ENUM("private", "shared", "shared_floor", "none"),
      allowNull: false,
      defaultValue: "private",
    },
    hasHotWater: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    floorNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Size in square meters/feet",
    },
    hasKitchen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    kitchenType: {
      type: DataTypes.ENUM("full", "partial", "shared", "none"),
      allowNull: true,
    },
    hasLivingRoom: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasDiningArea: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasBalcony: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasGarden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasPoolAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cleaningFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    securityDeposit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    extraGuestFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    minimumStay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Minimum nights required for booking",
    },
    smokingAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    petsAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    eventsAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
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
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "home_stays",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeUpdate: (homestay) => {
        if (
          homestay.changed("approvalStatus") ||
          homestay.changed("availabilityStatus")
        ) {
          homestay.lastStatusChange = new Date();
        }

        if (
          homestay.changed("approvalStatus") &&
          homestay.approvalStatus === "approved"
        ) {
          homestay.approvedAt = new Date();
        }
      },
    },
  }
);

module.exports = HomeStay;
