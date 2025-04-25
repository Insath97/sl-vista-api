const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class SubCategory extends Model {
  static associate(models) {
    // Relationship with Category (parent)
    this.belongsTo(models.Category, {
      foreignKey: "categoryId",
      as: "category",
      onDelete: "CASCADE" // Delete subcategory if parent category is deleted
    });
  }

  // Instance Methods (mirroring Category model)
  async toggleVisibility() {
    this.isActive = !this.isActive;
    return await this.save();
  }

  // Static Methods
  static async getActiveByCategory(categoryId) {
    return await this.findAll({
      where: { 
        categoryId,
        isActive: true 
      },
      order: [["position", "ASC"]],
      attributes: ["id", "name", "slug", "position"]
    });
  }
}

SubCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true }
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "categories",
        key: "id"
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Subcategory name cannot be empty" },
        len: {
          args: [2, 100],
          msg: "Name must be 2-100 characters"
        }
      },
      set(value) {
        this.setDataValue("name", value.trim());
        if (!this.slug) {
          this.slug = slugify(value, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
          });
        }
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        msg: "This slug is already in use"
      },
      validate: {
        is: {
          args: /^[a-z0-9-]+$/,
          msg: "Slug can only contain lowercase letters, numbers and hyphens"
        },
        notEmpty: true
      }
    },
    icon: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: {
          msg: "Icon must be a valid URL"
        }
      }
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    description: {
      type: DataTypes.TEXT,
      set(value) {
        this.setDataValue("description", value?.trim() || null);
      }
    },
    metaTitle: {
      type: DataTypes.STRING(100),
      validate: { len: [0, 100] }
    },
    metaDescription: {
      type: DataTypes.STRING(160),
      validate: { len: [0, 160] }
    }
  },
  {
    sequelize,
    tableName: "subcategories",
    timestamps: true,
    paranoid: true, // Enables soft deletion
    defaultScope: {
      where: { isActive: true },
      order: [["position", "ASC"]]
    },
    scopes: {
      withInactive: {
        where: {}
      },
      forAdmin: {
        paranoid: false,
        attributes: { exclude: [] }
      },
      withProducts: {
        include: ["products"]
      }
    },
    hooks: {
      beforeValidate: (subCategory) => {
        if ((subCategory.changed("name") || !subCategory.slug) && subCategory.name) {
          subCategory.slug = slugify(subCategory.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
          });
        }
      }
    }
  }
);

module.exports = SubCategory;