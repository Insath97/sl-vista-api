// models/Unit.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Unit extends Model {
  static associate(models) {
    this.belongsTo(models.Property, {
      foreignKey: "propertyId",
      as: "property",
      onDelete: "CASCADE",
    });

    this.hasMany(models.UnitImage, {
      foreignKey: "unitId",
      as: "images",
      onDelete: "CASCADE",
    });

    this.belongsToMany(models.Amenity, {
      through: models.UnitAmenity,
      foreignKey: "unitId",
      as: "amenities",
    });

    this.hasMany(models.UnitAmenity, {
      foreignKey: "unitId",
      as: "unitAmenities",
    });
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.UnitImage.bulkCreate(
      images.map((image) => ({
        unitId: this.id,
        ...image,
      }))
    );
  }

  async addAmenities(amenityIds, options = {}) {
    return await this.sequelize.models.UnitAmenity.bulkCreate(
      amenityIds.map((amenityId) => ({
        unitId: this.id,
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
        const image = await this.sequelize.models.UnitImage.findOne({
          where: { id: update.id, unitId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.UnitImage.create({
          unitId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  async updateAmenities(amenityUpdates) {
    await this.sequelize.models.UnitAmenity.destroy({
      where: { unitId: this.id },
    });
    return this.addAmenities(amenityUpdates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.UnitImage.update(
      { isFeatured: false },
      { where: { unitId: this.id } }
    );

    const image = await this.sequelize.models.UnitImage.findOne({
      where: { id: imageId, unitId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }

  async toggleAmenityAvailability(amenityId) {
    const unitAmenity = await this.sequelize.models.UnitAmenity.findOne({
      where: { unitId: this.id, amenityId },
    });

    if (!unitAmenity) {
      throw new Error("Amenity not found for this unit");
    }

    unitAmenity.isAvailable = !unitAmenity.isAvailable;
    return await unitAmenity.save();
  }
}

Unit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "properties",
        key: "id",
      },
    },
    unitCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: { msg: "This unit code is already in use" },
      validate: {
        notEmpty: true,
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
    type: {
      type: DataTypes.ENUM("room"),
      allowNull: false,
      defaultValue: "room",
    },
    status: {
      type: DataTypes.ENUM("available", "occupied", "maintenance"),
      allowNull: false,
      defaultValue: "available",
    },
    floorNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: -1,
        max: 200,
      },
    },
    maxAdults: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 1,
      },
    },
    maxChildren: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    basePrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    bedConfiguration: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Unit",
    tableName: "units",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true, status: "available" },
    },
    scopes: {
      inactive: {
        where: { isActive: false },
      },
      occupied: {
        where: { status: "occupied" },
      },
      maintenance: {
        where: { status: "maintenance" },
      },
      withImages: {
        include: ["images"],
      },
      withAmenities: {
        include: ["amenities"],
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["unitCode"],
      },
      {
        fields: ["propertyId"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

module.exports = Unit;
