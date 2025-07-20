const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");
const slugify = require("slugify");

class Events extends Model {
  static associate(models) {
    this.hasMany(models.EventsImages, {
      foreignKey: "eventId",
      as: "images",
      onDelete: "CASCADE",
    });
  }

  //Helper method to add images
  async addImages(images) {
    return await this.sequelize.models.EventsImages.bulkCreate(
      images.map((image) => ({
        eventId: this.id,
        ...image,
      }))
    );
  }

  // Helper method to update images
  async updateImages(imageUpdates) {
    const updates = imageUpdates.map(async (update) => {
      const EventsImages = this.sequelize.models.EventsImages;

      if (update.id) {
        const image = await EventsImages.findOne({
          where: { id: update.id, eventId: this.id },
        });

        if (!image) throw new Error(`Image with ID ${update.id} not found`);

        return await image.update(update);
      } else {
        return await EventsImages.create({
          eventId: this.id,
          ...update,
        });
      }
    });

    return Promise.all(updates);
  }

  //Helper method to set featured image
  async setFeaturedImage(imageId) {
    await this.sequelize.models.EventsImages.update(
      { isFeatured: false },
      { where: { eventId: this.id } }
    );
    const image = await this.sequelize.models.EventsImages.findOne({
      where: { id: imageId, eventId: this.id },
    });
    if (!image) throw new Error(`Image with ID${imageId}not found`);

    return await image.update({ isFeatured: true });
  }
}

Events.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      validate: { isInt: true },
    },

    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      set(value) {
        this.setDataValue("title", value.trim());
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    venue: {
      type: DataTypes.STRING(50),
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
    eventDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    eventTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: { msg: "Invalid email format" },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number is required" },
      },
    },
    website: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: { msg: "Invalid website URL" },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "events",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    hooks: {
      beforeValidate: (event) => {
        if (event.changed("name") || !event.slug) {
          event.slug = slugify(event.name || "", {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = Events;
