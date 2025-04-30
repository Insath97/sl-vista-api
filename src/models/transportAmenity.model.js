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
    notes: {
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue('notes', value ? value.trim() : null);
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
        fields: ["transportId", "amenityId"]
      }
    ],
    hooks: {
      beforeCreate: async (transportAmenity) => {
        // Ensure the amenity exists
        const amenity = await transportAmenity.sequelize.models.Amenity.findByPk(transportAmenity.amenityId);
        if (!amenity) {
          throw new Error('Amenity not found');
        }
      }
    }
  }
);

module.exports = TransportAmenity;