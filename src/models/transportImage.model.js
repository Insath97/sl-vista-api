const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const unlinkAsync = promisify(fs.unlink);

class TransportImage extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      as: "transport",
      onDelete: 'CASCADE'
    });
  }

  // Delete file from disk
  async deleteFile() {
    try {
      const fullPath = path.join(__dirname, '/', this.imagePath);
      if (fs.existsSync(fullPath)) {
        await unlinkAsync(fullPath);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }
}

TransportImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    imagePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "transport_images",
    timestamps: true,
    hooks: {
      afterDestroy: async (image) => {
        await image.deleteFile();
      },
      afterUpdate: async (image) => {
        if (image.changed('imagePath')) {
          const oldPath = image.previous('imagePath');
          if (oldPath) {
            const oldImage = new TransportImage({ imagePath: oldPath });
            await oldImage.deleteFile();
          }
        }
      },
    },
  }
);

module.exports = TransportImage;