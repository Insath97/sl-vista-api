const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportAmenity extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      as: "transport",
      onDelete: "CASCADE"
    });
    
    this.belongsTo(models.Amenity, {
      foreignKey: "amenityId", 
      as: "amenity",
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
      validate: { isInt: true }
    },
    transportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "transports",
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
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue("notes", value?.trim() || null);
      }
    }
  },
  {
    sequelize,
    tableName: "transport_amenities",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["transportId", "amenityId"],
        name: "unique_amenity_per_transport"
      }
    ]
  }
);

module.exports = TransportAmenity;