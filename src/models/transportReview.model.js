const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class TransportReview extends Model {
  static associate(models) {
    this.belongsTo(models.Transport, {
      foreignKey: "transportId",
      as: "transport",
    });
    
    this.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      constraints: false, 
    });
    
  }
}

TransportReview.init(
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow anonymous reviews
      references: {
        model: "users",
        key: "id",
      },
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    text: {
      type: DataTypes.TEXT,
      validate: {
        len: [10, 2000],
      },
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isVistaReview: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
    },
  },
  {
    sequelize,
    tableName: "transport_reviews",
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ["transportId"] },
      { fields: ["userId"] },
      { fields: ["isVistaReview"] },
      { fields: ["status"] },
    ],
    hooks: {
      beforeCreate: (review) => {
        // Vista reviews are automatically approved
        if (review.isVistaReview) {
          review.status = "approved";
        }
        
        // Validate anonymous reviews
        if (review.isAnonymous && review.userId) {
          throw new Error("Anonymous reviews cannot have a user ID");
        }
      },
    },
  }
);

module.exports = TransportReview;