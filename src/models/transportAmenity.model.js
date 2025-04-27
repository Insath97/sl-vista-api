const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportAmenity extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      onDelete: "CASCADE"
    });
    
    this.belongsTo(models.Amenity, {
      foreignKey: "amenityId", 
      onDelete: "CASCADE"
    });
  }
}

TransportAmenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amenityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: DataTypes.TEXT
  },
  {
    sequelize,
    tableName: "transport_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["transportId", "amenityId"]
      }
    ]
  }
);

module.exports = TransportAmenity;