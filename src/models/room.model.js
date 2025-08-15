const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Room extends Model {
  static associate(models) {
    this.belongsTo(models.Property, {
      foreignKey: "propertyId",
      as: "property",
      onDelete: "CASCADE",
    });

    this.belongsToMany(models.Amenity, {
      through: models.RoomAmenity,
      foreignKey: "roomId",
      as: "amenities",
    });

    this.hasMany(models.RoomAmenity, {
      foreignKey: "roomId",
      as: "roomAmenities",
    });

    this.belongsTo(models.RoomType, {
      foreignKey: "roomTypeId",
      as: "roomType",
      onDelete: "CASCADE",
    });

    this.hasMany(models.RoomImage, {
      foreignKey: "roomId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper methods for amenities
  async addImages(images) {
    if (!Array.isArray(images)) {
      throw new Error("Images must be provided as an array");
    }
    return await this.sequelize.models.RoomImage.bulkCreate(
      images.map((image) => ({
        roomId: this.id,
        ...image,
      }))
    );
  }

  async updateImages(updates) {
    const results = await Promise.all(
      updates.map(async (update) => {
        if (update.id) {
          const image = await this.sequelize.models.RoomImage.findOne({
            where: { id: update.id, roomId: this.id },
            paranoid: false, // Include soft-deleted images
          });

          if (!image) {
            throw new Error(
              `Image with ID ${update.id} not found for this room`
            );
          }

          // Restore if soft-deleted
          if (image.deletedAt) {
            await image.restore();
          }

          return image.update(update);
        } else {
          return this.sequelize.models.RoomImage.create({
            roomId: this.id,
            ...update,
          });
        }
      })
    );

    return results;
  }

  async addAmenities(amenityIds, options = {}) {
    return await this.sequelize.models.RoomAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        roomId: this.id,
        amenityId,
        ...options,
      })),
      { returning: true }
    );
  }

  async updateAmenities(amenityUpdates) {
    await this.sequelize.models.RoomAmenity.destroy({
      where: { roomId: this.id },
    });
    return this.addAmenities(amenityUpdates);
  }
}

Room.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "properties",
        key: "id",
      },
    },
    roomTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "room_types",
        key: "id",
      },
    },
    roomNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    floor: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "GF",
    },
    maxOccupancy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 1,
      },
    },
    sizeSqft: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Room size in square feet",
    },
    bedConfiguration: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "1 Double Bed",
      validate: {
        isIn: [
          [
            "1 Single Bed",
            "1 Double Bed",
            "2 Single Beds",
            "1 Double + 1 Single",
            "Other",
          ],
        ],
      },
    },
    bedroomCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    hasAc: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    hasTV: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    hasBalcony: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasBathroom: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    smokingAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isAccessible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Wheelchair accessible",
    },
    bathroomCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 0,
      },
    },
    hasKitchen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasLivingArea: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasDiningArea: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasWifi: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    hasMinibar: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasSafe: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hasHairdryer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastMaintenanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    nextMaintenanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    viewType: {
      type: DataTypes.ENUM("Sea", "Garden", "City", "Mountain", "Pool", "None"),
      allowNull: false,
      defaultValue: "None",
    },
    maintenanceNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    cleaningStatus: {
      type: DataTypes.ENUM("Clean", "Dirty", "In Progress", "Maintenance"),
      allowNull: false,
      defaultValue: "Clean",
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
    lastCleanedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Room",
    tableName: "rooms",
    paranoid: true,
    defaultScope: {
      where: {},
    },
    scopes: {
      available: {
        where: {
          isActive: true,
          availabilityStatus: "available",
        },
      },
      withInactive: {
        where: {},
      },
      forAdmin: {
        paranoid: false,
      },
    },
    hooks: {
      beforeUpdate: (room) => {
        // Update status change timestamp
        if (
          room.changed("approvalStatus") ||
          room.changed("availabilityStatus") ||
          room.changed("cleaningStatus")
        ) {
          room.lastStatusChange = new Date();
        }

        // Set approved timestamp
        if (
          room.changed("approvalStatus") &&
          room.approvalStatus === "approved"
        ) {
          room.approvedAt = new Date();
          room.vistaVerified = true; // Auto-verify when approved
        }

        // Auto-update maintenance dates
        if (room.changed("maintenanceNotes")) {
          room.lastMaintenanceDate = new Date();
          if (room.cleaningStatus === "Maintenance") {
            room.nextMaintenanceDate = new Date(
              new Date().setDate(new Date().getDate() + 7)
            );
          }
        }
      },
      afterCreate: (room) => {
        // Set initial maintenance dates
        room.lastMaintenanceDate = new Date();
        room.nextMaintenanceDate = new Date(
          new Date().setDate(new Date().getDate() + 30)
        );
      },
    },
  }
);

module.exports = Room;
