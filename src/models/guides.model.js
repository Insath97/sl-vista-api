const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class Guides extends Model {
  static associate(models) {
    this.hasMany(models.GuidesImages, {
      foreignKey: "guideId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  // Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.GuidesImages.bulkCreate(
      images.map((image) => ({
        guideId: this.id,
        ...image,
      }))
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      if (update.id) {
        const image = await this.sequelize.models.GuidesImages.findOne({
          where: { id: update.id, guideId: this.id },
        });
        if (!image) throw new Error(`Image with ID ${update.id} not found`);
        return await image.update(update);
      } else {
        return await this.sequelize.models.GuidesImages.create({
          guideId: this.id,
          ...update,
        });
      }
    });
    return Promise.all(updates);
  }

  // Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.GuidesImages.update(
      { isFeatured: false },
      { where: { guideId: this.id } }
    );

    const image = await this.sequelize.models.GuidesImages.findOne({
      where: { id: imageId, guideId: this.id },
    });

    if (!image) throw new Error(`Image with ID ${imageId} not found`);

    return await image.update({ isFeatured: true });
  }
}

Guides.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },
    guide_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Name cannot be empty" },
        len: [2, 100],
      },
      set(value) {
        this.setDataValue("guide_name", value.trim());
        if (!this.slug) {
          this.setDataValue(
            "slug",
            slugify(value, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g,
            })
          );
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
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    languages: {
      type: DataTypes.STRING(255),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue("languages");
        return rawValue ? rawValue.split(",") : [];
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue("languages", value.join(","));
        } else {
          this.setDataValue("languages", value);
        }
      },
    },
    licenceId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "Licence ID is required" },
        len: [1, 100],
      },
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: "Invalid date format" },
        notEmpty: { msg: "Expiry date is required" },
        isAfterCurrentDate(value) {
          if (new Date(value) < new Date()) {
            throw new Error("Expiry date must be in the future");
          }
        },
      },
    },
    experience: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: { args: [0], msg: "Experience cannot be negative" },
      },
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    specialties: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue("specialties");
        return rawValue ? rawValue.split(",") : [];
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue("specialties", value.join(","));
        } else {
          this.setDataValue("specialties", value);
        }
      },
    },
    ratePerDayAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: { args: [0], msg: "Rate cannot be negative" },
      },
    },
    ratePerDayCurrency: {
      type: DataTypes.ENUM("USD", "LKR", "EUR", "GBP"),
      allowNull: false,
      defaultValue: "USD",
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number is required" },
      },
    },
    whatsapp: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    instagram: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    facebook: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    vistaVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "guides",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeValidate: (guide) => {
        if (guide.changed("guide_name") || !guide.slug) {
          guide.slug = slugify(guide.guide_name || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Guides;
