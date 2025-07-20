const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class LocalArtists extends Model {
  static associate(models) {
    this.belongsToMany(models.ArtistType, {
      through: models.LocalArtistsType, // join model
      foreignKey: "localArtistId",
      as: "artistTypes",
    });

    this.hasMany(models.LocalArtistsImage, {
      foreignKey: "localArtistId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add artist types
  async addArtistTypes(artistTypeIds) {
    return await this.sequelize.models.LocalArtistsType.bulkCreate(
      artistTypeIds.map((artistTypeId) => ({
        localArtistId: this.id,
        artistTypeId,
      }))
    );
  }

  // Helper method to update artist types
  async updateArtistTypes(artistTypeIds) {
    await this.sequelize.models.LocalArtistsType.destroy({
      where: { localArtistId: this.id },
    });
    return this.addArtistTypes(artistTypeIds);
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.LocalArtistsImage.bulkCreate(
      images.map((image) => ({
        localArtistId: this.id,
        ...image,
      }))
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.LocalArtistsImage.findOne({
          where: { id: update.id, localArtistId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.LocalArtistsImage.create({
          localArtistId: this.id,
          ...update,
        });
      }
    });

    return Promise.all(updates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.LocalArtistsImage.update(
      { isFeatured: false },
      { where: { localArtistId: this.id } }
    );

    const image = await this.sequelize.models.LocalArtistsImage.findOne({
      where: { id: imageId, localArtistId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

LocalArtists.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Name cannot be empty" },
        len: [2, 100],
      },
      set(value) {
        this.setDataValue("name", value.trim());
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
    specialization: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Specialization is required" },
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
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    website: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: {
          msg: "Invalid website URL",
          protocols: ["http", "https"],
          require_protocol: true,
        },
      },
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
    tableName: "local_artists",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },

    hooks: {
      beforeValidate: (artist) => {
        if (artist.changed("name") || !artist.slug) {
          artist.slug = slugify(artist.name || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = LocalArtists;
