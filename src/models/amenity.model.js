const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Amenity extends Model {
  static associate(models) {
    this.belongsToMany(models.Transport, {
      through: models.TransportAmenity,
      foreignKey: "amenityId",
      otherKey: "transportId",
      as: "transports",
    });
  }
  async toggleVisibility() {
    this.isActive = !this.isActive;
    return await this.save();
  }
}

Amenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
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
        notEmpty: { msg: "Amenity name cannot be empty" },
        len: { args: [2, 100], msg: "Name must be between 2-100 characters" },
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
      unique: { msg: "This slug is already in use" },
      validate: {
        is: {
          args: /^[a-z0-9-]+$/,
          msg: "Slug can only contain lowercase letters, numbers and hyphens",
        },
        notEmpty: true,
      },
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        isIn: {
          args: [
            ["general", "comfort", "safety", "entertainment", "food", "other"],
          ],
          msg: "Invalid amenity category",
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
    tableName: "amenities",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
      order: [["name", "ASC"]],
    },
    scopes: {
      withInactive: { where: {} },
      forAdmin: { paranoid: false },
      byCategory: (category) => ({ where: { category } }),
    },
    hooks: {
      beforeValidate: (amenity) => {
        if (amenity.changed("name") || !amenity.slug) {
          amenity.slug = slugify(amenity.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Amenity;
