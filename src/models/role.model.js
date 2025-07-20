const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Role extends Model {
  static associate(models) {
    this.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: "roleId",
      as: "users",
    });

    this.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: "roleId",
      as: "permissions",
    });

    this.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });

    this.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updater",
    });
  }

  // Add permissions to role
  async addPermissions(permissionIds, options = {}) {
    const { transaction, userId } = options;

    return await this.sequelize.models.RolePermission.bulkCreate(
      permissionIds.map((permissionId) => ({
        roleId: this.id,
        permissionId,
        assignedBy: userId,
        ...options,
      })),
      {
        returning: true,
        transaction,
      }
    );
  }

  // Replace all permissions
  async setPermissions(permissionIds, options = {}) {
    const { transaction, userId } = options;

    await this.removePermissions(null, { transaction });

    if (permissionIds?.length) {
      return await this.addPermissions(permissionIds, {
        transaction,
        userId,
      });
    }
    return [];
  }

  // Remove permissions
  async removePermissions(permissionIds = null, options = {}) {
    const { transaction } = options;
    const where = { roleId: this.id };

    if (permissionIds) {
      where.permissionId = permissionIds;
    }

    return await this.sequelize.models.RolePermission.destroy({
      where,
      transaction,
    });
  }

  // Check permission
  async hasPermission(permissionId) {
    const count = await this.sequelize.models.RolePermission.count({
      where: {
        roleId: this.id,
        permissionId,
      },
    });
    return count > 0;
  }

  toJSON() {
    const values = super.toJSON();
    delete values.deletedAt;
    return values;
  }
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      set(value) {
        this.setDataValue("name", value.trim());
      },
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userType: {
      type: DataTypes.ENUM("admin", "merchant"),
      allowNull: false,
      defaultValue: "admin",
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "System roles cannot be modified or deleted",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Role",
    tableName: "roles",
    timestamps: true,
    paranoid: true,
    defaultScope: {
      where: { isActive: true },
    },
    scopes: {
      withInactive: {
        where: {},
      },
      system: {
        where: { userType: "system" },
      },
      admin: {
        where: { userType: "admin" },
      },
      merchant: {
        where: { userType: "merchant" },
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["name"],
      },
      {
        fields: ["userType"],
      },
      {
        fields: ["isSystem"],
      },
    ],
  }
);

module.exports = Role;
