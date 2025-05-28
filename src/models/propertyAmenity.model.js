const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class PropertyAmenity extends Model {}

PropertyAmenity.init(
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
    amenityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "amenities",
        key: "id",
      },
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "property_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["propertyId", "amenityId"],
      },
      {
        fields: ["amenityId"],
      },
    ],
  }
);

module.exports = PropertyAmenity;
