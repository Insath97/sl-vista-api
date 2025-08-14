const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class RoomType extends Model {
  static associate(models) {
    this.hasMany(models.Room, {
      foreignKey: "roomTypeId",
      as: "rooms",
      onDelete: "CASCADE",
    });
  }
}

RoomType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "room_types",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: {},
    },
  }
);

module.exports = RoomType;
