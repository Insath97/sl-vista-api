// models/localArtistsType.model.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class LocalArtistsType extends Model {}

LocalArtistsType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    localArtistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "local_artists",
        key: "id",
      },
    },
    artistTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "artist_types",
        key: "id",
      },
    },
  },
  {
    sequelize,
    tableName: "local_artists_types",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["localArtistId", "artistTypeId"],
      },
    ],
  }
);

module.exports = LocalArtistsType;
