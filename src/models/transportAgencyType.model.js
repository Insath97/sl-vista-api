const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class TransportAgencyType extends Model {}

TransportAgencyType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transportAgencyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "transport_agencies",
        key: "id",
      },
    },
    transportTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "transport_types",
        key: "id",
      },
    },
  },
  {
    sequelize,
    tableName: "transport_agency_types",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["transportAgencyId", "transportTypeId"],
      },
    ],
  }
);

module.exports = TransportAgencyType;
