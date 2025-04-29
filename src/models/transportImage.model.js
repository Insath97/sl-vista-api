const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");
const fs = require('fs');
const path = require('path');

class TransportImage extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      as: "transport",
      onDelete: 'CASCADE'
    });
  }

  async deleteFile() {
    try {
      const filePath = path.join(__dirname, '../../public', this.imagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting image file:', error);
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
      references: {
        model: "transports",
        key: "id",
      },
    },
    imagePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Image path is required" },
      },
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    caption: {
      type: DataTypes.STRING(100),
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
    paranoid: true,
    hooks: {
      beforeDestroy: async (image) => {
        await image.deleteFile();
      },
      beforeUpdate: async (image) => {
        if (image.changed('imagePath')) {
          const oldImage = await TransportImage.findByPk(image.id);
          await oldImage.deleteFile();
        }
      },
    },
  }
);

module.exports = TransportImage;