const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");
const slugify = require("slugify");

class Activities extends Model {
  static associate(models) {
    this.hasMany(models.ActivitiesImages, {
      foreignKey: "activityId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add images
  async addImages(images) {
    return await this.constructor.sequelize.models.ActivitiesImages.bulkCreate(
      images.map((image) => ({
        activityId: this.id,
        ...image,
      }))
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const ActivitiesImages = this.constructor.sequelize.models.ActivitiesImages;

    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await ActivitiesImages.findOne({
          where: { id: update.id, activityId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await ActivitiesImages.create({
          activityId: this.id,
          ...update,
        });
      }
    });

    return Promise.all(updates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    const ActivitiesImages = this.constructor.sequelize.models.ActivitiesImages;

    await ActivitiesImages.update(
      { isFeatured: false },
      { where: { activityId: this.id } }
    );

    const image = await ActivitiesImages.findOne({
      where: { id: imageId, activityId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

Activities.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      set(value) {
        this.setDataValue("title", value.trim());
        const slug = slugify(value, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        });
        if (!this.slug) {
          this.setDataValue("slug", slug);
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
    pricerange: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        "Adventure",
        "Cultural",
        "Historical",
        "Nature & Wildlife",
        "Wellness & Spa",
        "Culinary / Food Tour",
        "Arts & Crafts",
        "Water Activities",
        "Sports & Games",
        "Religious / Spiritual"
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
    district: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "activities",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    scopes: {
      withInactive: { where: {} },
      forAdmin: { paranoid: false },
    },
    hooks: {
      beforeValidate: (activity) => {
        if (!activity.slug && activity.title) {
          activity.slug = slugify(activity.title, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Activities;
