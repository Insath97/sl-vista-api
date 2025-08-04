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
    tableName: "artist_types",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { },
    },
    scopes: {
      withInactive: {
        where: {},
      },
      forAdmin: {
        paranoid: false,
      },
    }
  }
);

module.exports = ArtistType;
