const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Category extends Model {
  static associate(models) {
    this.hasMany(models.SubCategory, {
      foreignKey: "categoryId",
      as: "subcategories",
      onDelete: "CASCADE",
      hooks: true,
    });
  }

  // Instance Methods
  async toggleVisibility() {
    this.isActive = !this.isActive;
    return await this.save();
  }

  async toggleNavVisibility() {
    this.showInNav = !this.showInNav;
    return await this.save();
  }

  // Static Methods
  static async getNavbarCategories() {
    return await this.findAll({
      where: {
        isActive: true,
        showInNav: true,
      },
      order: [["position", "ASC"]],
      attributes: ["id", "name", "slug", "icon", "position"],
    });
  }
}

Category.init(
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
          msg: "Category name cannot be empty",
        },
        len: {
          args: [2, 100],
          msg: "Category name must be between 2-100 characters",
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
          msg: "Slug can only contain lowercase letters, numbers and hyphens",
        },
        notEmpty: true,
      },
    },
    icon: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: {
          msg: "Icon must be a valid URL",
        },
      },
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    showInNav: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    description: {
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue("description", value?.trim() || null);
      },
    },
    metaTitle: {
      type: DataTypes.STRING(100),
      validate: {
        len: [0, 100],
      },
    },
    metaDescription: {
      type: DataTypes.STRING(160),
      validate: {
        len: [0, 160],
      },
    },
  },
  {
    sequelize,
    tableName: "categories",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
      order: [["position", "ASC"]],
    },
    scopes: {
      withInactive: {
        where: {},
      },
      forAdmin: {
        paranoid: false,
        attributes: { exclude: [] },
      },
      withSubcategories: {
        include: ["subcategories"],
      },
    },
    hooks: {
      beforeValidate: (category) => {
        if (category.name && !category.slug) {
          category.slug = slugify(category.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  }
);

module.exports = Category;
