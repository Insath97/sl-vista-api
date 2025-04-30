const { DataTypes, Model , Op} = require("sequelize");
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
    });
  }

  static async canUserReview(userId, transportId) {
    if (!userId) return false;
    
    const existingReview = await this.findOne({
      where: {
        userId,
        transportId,
        status: { [sequelize.Op.ne]: 'rejected' }
      }
    });
    
    return !existingReview;
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
      allowNull: false,
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
        len: {
          args: [10, 2000],
          msg: "Review must be between 10 and 2000 characters"
        },
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
    adminNotes: {
      type: DataTypes.TEXT,
      comment: "Notes from admin about review approval/rejection"
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
      { 
        fields: ["userId", "transportId"],
        unique: true,
        where: {
          status: { [Op.ne]: 'rejected' }
        }
      }
    ],
    hooks: {
      beforeCreate: async (review) => {
        // Vista reviews are automatically approved
        if (review.isVistaReview) {
          review.status = "approved";
        }
        
        // Validate anonymous reviews
        if (review.isAnonymous) {
          review.userId = null;
        }
        
        // Check if user has already reviewed this transport
        if (review.userId && !review.isVistaReview) {
          const canReview = await TransportReview.canUserReview(review.userId, review.transportId);
          if (!canReview) {
            throw new Error("You have already submitted a review for this transport");
          }
        }
      },
    },
  }
);

module.exports = TransportReview;