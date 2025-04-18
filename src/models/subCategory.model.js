const { DataTypes, Model, Op } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class SubCategory extends Model {
  static associate(models) {
    this.belongsTo(models.Category, {
      foreignKey: "categoryId",
      as: "category"
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

  async updatePosition(newPosition) {
    await sequelize.transaction(async (t) => {
      await SubCategory.shiftPositions(this.categoryId, this.position, newPosition, { transaction: t });
      this.position = newPosition;
      await this.save({ transaction: t });
    });
  }

  // Static Methods
  static async getNavbarSubCategories() {
    return await this.findAll({
      where: { isActive: true, showInNav: true },
      include: [{
        model: this.sequelize.models.Category,
        as: "category",
        attributes: ["id", "name", "slug"],
        where: { isActive: true }
      }],
      order: [["position", "ASC"]],
      attributes: ["id", "name", "slug", "icon"]
    });
  }

  static async shiftPositions(categoryId, from, to, options = {}) {
    if (from < to) {
      await this.decrement("position", {
        where: { 
          categoryId,
          position: { [Op.gt]: from, [Op.lte]: to } 
        },
        ...options
      });
    } else {
      await this.increment("position", {
        where: { 
          categoryId,
          position: { [Op.lt]: from, [Op.gte]: to } 
        },
        ...options
      });
    }
  }
}

SubCategory.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "categories",
      key: "id"
    }
  },
  language_code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [["en", "ar", "fr"]]
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    },
    set(value) {
      this.setDataValue("name", value.trim());
      if (!this.slug) {
        this.slug = slugify(value, { lower: true, strict: true });
      }
    }
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isSlug: (value) => {
        if (!/^[a-z0-9-]+$/.test(value)) {
          throw new Error("Slug must be URL-friendly");
        }
      }
    }
  },
  icon: {
    type: DataTypes.STRING(50),
    validate: {
      isUrl: true
    }
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  showInNav: {
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
    allowNull: true
  },
  metaDescription: {
    type: DataTypes.STRING(160),
    allowNull: true
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: "sub_categories",
  timestamps: true,
  paranoid: true,
  defaultScope: {
    where: { isActive: true },
    order: [["position", "ASC"]]
  },
  scopes: {
    withInactive: {
      where: {}
    },
    forAdmin: {
      attributes: { exclude: [] },
      paranoid: false
    },
    byCategory: (categoryId) => ({
      where: { categoryId }
    })
  },
  hooks: {
    afterCreate: async (subCategory) => {
      await SubCategory.reorderPositions(subCategory.categoryId);
    },
    afterDestroy: async (subCategory) => {
      await SubCategory.reorderPositions(subCategory.categoryId);
    }
  }
});

module.exports = SubCategory;