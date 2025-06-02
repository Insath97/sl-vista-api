const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class UnitAmenity extends Model {}

UnitAmenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    unitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "units",
        key: "id"
      }
    },
    amenityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "amenities",
        key: "id"
      }
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: "UnitAmenity",
    tableName: "unit_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["unitId", "amenityId"]
      },
      {
        fields: ["amenityId"]
      }
    ]
  }
);

module.exports = UnitAmenity;