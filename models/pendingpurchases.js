'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PendingPurchase extends Model {
    static associate(models) {
      // Define associations here if necessary
    }
  }

  PendingPurchase.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      businessId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Businesses',
          key: 'id',
        }
      },
      itemIds: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false,
      },
      quantities: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false,
      },
      cheapestUnitPrice: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        allowNull: false,
      },
      vendor: {
        type: DataTypes.ARRAY(DataTypes.STRING(255)),
        allowNull: false,
      },
      totalPrice: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'PendingPurchase',
      tableName: 'PendingPurchases',
    }
  );

  return PendingPurchase;
};
