const { DataTypes, Model } = require("sequelize");
const bcrypt = require("bcrypt");
const { sequelize } = require("../config/database");

class User extends Model {
  // Association method (will be called after all models are loaded)
  static associate(models) {
    this.hasOne(models.AdminProfile, {
      foreignKey: "userId",
      as: "adminProfile",
    });

    this.hasOne(models.MerchantProfile, {
      foreignKey: "userId",
      as: "merchantProfile",
      onDelete: "CASCADE",
    });
  }

  // Instance method to check password
  async isPasswordMatch(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Hide password when converting to JSON
  toJSON() {
    const values = { ...super.toJSON() };
    delete values.password;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [8, 128],
      },
    },
    accountType: {
      type: DataTypes.ENUM("admin", "merchant", "customer"),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastPasswordChange: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ["password"] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ["password"] },
      },
      admins: {
        where: { accountType: "admin" },
      },
      merchants: {
        where: { accountType: "merchant" },
      },
    },
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
          user.lastPasswordChange = new Date();
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 12);
          user.lastPasswordChange = new Date();
        }
      },
    },
  }
);

module.exports = User;
