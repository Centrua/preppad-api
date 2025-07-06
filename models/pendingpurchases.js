'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PendingPurchase extends Model {
    static associate(models) {
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
      totalPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
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
