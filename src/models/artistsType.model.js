const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class ArtistType extends Model {
  static associate(models) {
    this.belongsToMany(models.LocalArtists, {
      through: models.LocalArtistsType,
      foreignKey: "artistTypeId",
      as: "localArtists",
    });
  }

  async toggleVisibility() {
    this.isActive = !this.isActive;
    return await this.save();
  }
}

ArtistType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: {
        isInt: true,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Artist type name cannot be empty",
        },
        len: {
          args: [2, 100],
          msg: "Name must be between 2-100 characters",
        },
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
      unique: {
        msg: "This slug is already in use",
      },
      validate: {
        is: {
          args: /^[a-z0-9-]+$/,
          msg: "Slug can only contain lowercase letters, numbers, and hyphens",
        },
        notEmpty: true,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "artist_types",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    scopes: {
      withInactive: {
        where: {},
      },
      forAdmin: {
        paranoid: false,
      },
    },
    hooks: {
      beforeValidate: (artistType) => {
        if (artistType.changed("name") || !artistType.slug) {
          artistType.slug = slugify(artistType.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = ArtistType;
