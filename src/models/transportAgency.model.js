const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class TransportAgency extends Model {
  static associate(models) {
    this.belongsToMany(models.TransportType, {
      through: models.TransportAgencyType,
      foreignKey: "transportAgencyId",
      as: "transportTypes",
    });

    this.hasMany(models.TransportAgencyImage, {
      foreignKey: "transportAgencyId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add transport types
  async addTransportTypes(transportTypeIds) {
    return await this.sequelize.models.TransportAgencyType.bulkCreate(
      transportTypeIds.map((transportTypeId) => ({
        transportAgencyId: this.id,
        transportTypeId,
      }))
    );
  }

  // Helper method to update transport types
  async updateTransportTypes(transportTypeIds) {
    await this.sequelize.models.TransportAgencyType.destroy({
      where: { transportAgencyId: this.id },
    });
    return this.addTransportTypes(transportTypeIds);
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.TransportAgencyImage.bulkCreate(
      images.map((image) => ({
        transportAgencyId: this.id,
        ...image,
      }))
    );
  }

  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.TransportAgencyImage.findOne({
          where: { id: update.id, transportAgencyId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.TransportAgencyImage.create({
          transportAgencyId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.TransportAgencyImage.update(
      { isFeatured: false },
      { where: { transportAgencyId: this.id } }
    );

    const image = await this.sequelize.models.TransportAgencyImage.findOne({
      where: { id: imageId, transportAgencyId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

TransportAgency.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
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
    serviceArea: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Service Area is required" },
      },
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
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    description: {
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
    tableName: "transport_agencies",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
  }
);

module.exports = TransportAgency;
