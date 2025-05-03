const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class LocalArtist extends Model {
  static associate(models) {
    this.belongsTo(models.LocalArtistType, {
      foreignKey: "artistTypeId",
      as: "artistType",
    });

    this.hasMany(models.LocalArtistImage, {
      foreignKey: "artistId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  async addImages(images) {
    return await this.sequelize.models.LocalArtistImage.bulkCreate(
      images.map((image) => ({ artistId: this.id, ...image }))
    );
  }

  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.LocalArtistImage.findOne({
          where: { id: update.id, artistId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.LocalArtistImage.create({
          artistId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }
}

LocalArtist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    artistTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "local_artist_types",
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
    specialization: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    language_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isIn: [["en", "ar", "fr"]],
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
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
  }
);

module.exports = LocalArtist;
