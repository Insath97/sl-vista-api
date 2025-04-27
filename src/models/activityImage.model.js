// models/ActivityImage.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class ActivityImage extends Model {
  static associate(models) {
    this.belongsTo(models.Activity, {
      foreignKey: "activityId",
      as: "activity",
    });
  }
}

ActivityImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    activityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "activities",
        key: "id",
      },
    },
    imagePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    caption: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "activity_images",
    timestamps: true,
  }
);

module.exports = ActivityImage;
