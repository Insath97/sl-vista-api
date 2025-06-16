const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class HomeStayAmenity extends Model {}

HomeStayAmenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    homestayId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "home_stays",
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
    tableName: "home_stay_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["homestayId", "amenityId"],
      },
      {
        fields: ["amenityId"],
      },
    ],
  }
);

module.exports = HomeStayAmenity;
