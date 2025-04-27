// models/Activity.js
const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Activity extends Model {
  static associate(models) {
    this.hasMany(models.ActivityImage, {
      foreignKey: "activityId",
      as: "images",
      onDelete: "CASCADE"
    });
  }

  async toggleStatus() {
    this.isActive = !this.isActive;
    return await this.save();
  }
}

Activity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    language_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isIn: [["en", "ar", "fr"]],
      },
      defaultValue: "en"
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Title cannot be empty" },
        len: { args: [2, 100], msg: "Title must be 2-100 characters" }
      },
      set(value) {
        this.setDataValue("title", value.trim());
        if (!this.slug) {
          this.slug = slugify(value, { lower: true, strict: true });
        }
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "This slug is already in use" },
      validate: {
        is: /^[a-z0-9-]+$/
      }
    },
    description: {
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue("description", value?.trim() || null);
      }
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "City is required" }
      }
    },
    province: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Province is required" }
      }
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -180,
        max: 180
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: "activities",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true }
    },
    scopes: {
      withInactive: { where: {} },
      forAdmin: { paranoid: false }
    },
    hooks: {
      beforeValidate: (activity) => {
        if (activity.changed("title") || !activity.slug) {
          activity.slug = slugify(activity.title, { 
            lower: true, 
            strict: true 
          });
        }
      }
    }
  }
);

module.exports = Activity;