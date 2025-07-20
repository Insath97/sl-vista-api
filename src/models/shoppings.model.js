const { Model, DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const slugify = require("slugify");

class Shopping extends Model {
  static associate(models) {
    this.hasMany(models.ShoppingImages, {
      foreignKey: "shoppingId",
      as: "images",
      onDelete: "CASCADE",
    });
  }
  // 💡 Helper method to add images to a Shopping instance
  async addImages(images) {
    return await this.sequelize.models.ShoppingImages.bulkCreate(
      images.map((image) => ({
        shoppingId: this.id,
        ...image,
      }))
    );
  }

  //Helper method to update or add images for Shopping
  async updateImages(imageUpdates) {
    const ShoppingImages = this.sequelize.models.ShoppingImages;

    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await ShoppingImages.findOne({
          where: { id: update.id, shoppingId: this.id },
        });

        if (!image) throw new Error(`Image with ID ${update.id} not found`);

        return await image.update(update);
      } else {
        return await ShoppingImages.create({
          shoppingId: this.id,
          ...update,
        });
      }
    });

    return Promise.all(updates);
  }

  //  Helper method to set featured image for Shopping
  async setFeaturedImage(imageId) {
    await this.sequelize.models.ShoppingImages.update(
      { isFeatured: false },
      { where: { shoppingId: this.id } }
    );

    const image = await this.sequelize.models.ShoppingImages.findOne({
      where: { id: imageId, shoppingId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

Shopping.init(
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
        const trimmed = value.trim();
        this.setDataValue("name", trimmed);
        if (!this.slug) {
          this.setDataValue(
            "slug",
            slugify(trimmed, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g,
            })
          );
        }
      },
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    category: {
      type: DataTypes.ENUM(
        "Handicrafts",
        "Textiles",
        "Jewelry",
        "Art",
        "Pottery"
      ),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      set(value) {
        this.setDataValue("phone", value.trim());
      },
      validate: {
        notEmpty: { msg: "Phone number is required" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      set(value) {
        if (value) this.setDataValue("email", value.trim());
      },
      validate: {
        isEmail: { msg: "Invalid email format" },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "shoppings",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeValidate: (shopping) => {
        if (shopping.changed("name") || !shopping.slug) {
          shopping.slug = slugify(shopping.name || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Shopping;
