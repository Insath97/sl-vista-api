const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class HomeStayAmenity extends Model {
  static associate(models) {
    this.belongsTo(models.HomeStay, {
      foreignKey: "homestayId",
      as: "homestay",
      onDelete: "CASCADE",
    });
    
    this.belongsTo(models.Amenity, {
      foreignKey: "amenityId",
      as: "amenity",
      onDelete: "CASCADE",
    });
  }
}

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
    tableName: "homestay_amenities",
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