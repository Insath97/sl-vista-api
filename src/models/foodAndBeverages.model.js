const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class FoodAndBeverage extends Model {
  static associate(models) {
    this.hasMany(models.FoodAndBeveragesImage, {
      foreignKey: "foodAndBeverageId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.FoodAndBeveragesImage.bulkCreate(
      images.map((image) => ({
        foodAndBeverageId: this.id,
        ...image,
      }))
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.FoodAndBeveragesImage.findOne(
          {
            where: { id: update.id, foodAndBeverageId: this.id },
          }
        );
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.FoodAndBeveragesImage.create({
          foodAndBeverageId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.FoodAndBeveragesImage.update(
      { isFeatured: false },
      { where: { foodAndBeverageId: this.id } }
    );
    const image = await this.sequelize.models.FoodAndBeveragesImage.findOne({
      where: { id: imageId, foodAndBeverageId: this.id },
    });
    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

FoodAndBeverage.init(
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
        notEmpty: { msg: "Name cannot be empty" },
        len: [2, 100],
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
        is: { args: /^[a-z0-9-]+$/, msg: "Invalid slug format" },
        notEmpty: true,
      },
    },
    cuisineType: {
      type: DataTypes.ENUM(
        "Chinese",
        "Japanese",
        "Thai",
        "Indian",
        "Korean",
        "Vietnamese",
        "Indonesian"
      ),
      allowNull: false,
    },
    province: {
      type: DataTypes.ENUM(
        "Western",
        "Central",
        "Southern",
        "Northern",
        "Eastern",
        "North Western",
        "North Central",
        "Uva",
        "Sabaragamuwa"
      ),
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number is required" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: { msg: "Invalid email format" },
      },
    },
    website: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: { msg: "Invalid website URL" },
      },
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "food_and_beverages",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeValidate: (food) => {
        if (food.changed("name") || !food.slug) {
          food.slug = slugify(food.name || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = FoodAndBeverage;
