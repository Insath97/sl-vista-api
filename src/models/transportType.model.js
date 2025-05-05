const { DataTypes, Model } = require("sequelize");
const slugify = require("slugify");
const { sequelize } = require("../config/database");

class TransportType extends Model {
  static associate(models) {
    this.belongsToMany(models.TransportAgency, {
      through: models.TransportAgencyType,
      foreignKey: "transportTypeId",
      as: "transportAgencies",
    });
  }

  async toggleVisibility() {
    this.isActive = !this.isActive;
    return await this.save();
  }
}

TransportType.init(
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
          msg: "Transport type name cannot be empty",
        },
        len: {
          args: [2, 100],
          msg: "Name must be between 2-100 characters",
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
          msg: "Slug can only contain lowercase letters, numbers, and hyphens",
        },
        notEmpty: true,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "transport_types",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    scopes: {
      withInactive: {
        where: {},
      },
      forAdmin: {
        paranoid: false,
      },
    },
    hooks: {
      beforeValidate: (transportType) => {
        if (transportType.changed("name") || !transportType.slug) {
          transportType.slug = slugify(transportType.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });
        }
      },
    },
  }
);

module.exports = TransportType;
