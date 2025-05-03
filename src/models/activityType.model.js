const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class ActivityType extends Model {}

ActivityType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: {
        isInt: true,
      },
    },
    language_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isIn: [["en", "ar", "fr"]],
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Activity type name cannot be empty",
        },
        len: {
          args: [2, 100],
          msg: "Name must be between 2-100 characters",
        },
      },
      set(value) {
        this.setDataValue("name", value.trim());
        if (!this.slug) {
          this.slug = slugify(value, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        msg: "This slug is already in use",
      },
      validate: {
        is: {
          args: /^[a-z0-9-]+$/,
          msg: "Slug can only contain lowercase letters, numbers, and hyphens",
        },
        notEmpty: true,
      },
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: {
          msg: "Icon must be a valid URL",
        },
        len: {
          args: [0, 255],
          msg: "Icon URL must be less than 255 characters",
        },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "activity_types",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeValidate: (activityType) => {
        if (activityType.changed("name") || !activityType.slug) {
          activityType.slug = slugify(activityType.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = ActivityType;
