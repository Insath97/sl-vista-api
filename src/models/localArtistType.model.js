const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class LocalArtistType extends Model {
  static associate(models) {
    this.hasMany(models.LocalArtist, {
      foreignKey: "artistTypeId",
      as: "artists",
      onDelete: "CASCADE",
    });
  }
}

LocalArtistType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: {
        isInt: true,
      },
    },
    language_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isIn: [["en", "ar", "fr"]],
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Local Artist type name cannot be empty",
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
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: {
          msg: "Icon must be a valid URL",
        },
        len: {
          args: [0, 255],
          msg: "Icon path must be less than 255 characters",
        },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "local_artist_types",
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeValidate: (localArtistType) => {
        if (localArtistType.name) {
          localArtistType.name = localArtistType.name.trim();
        }
        if (localArtistType.changed("name") || !localArtistType.slug) {
          localArtistType.slug = slugify(localArtistType.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
    defaultScope: {
      where: {
        isActive: true,
      },
    },
  }
);

module.exports = LocalArtistType;
