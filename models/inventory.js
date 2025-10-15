'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Inventory extends Model {
    static associate(models) {
      Inventory.belongsTo(models.Business, { foreignKey: 'businessId' });
    }
  }

  Inventory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      businessId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Businesses',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      quantityInStock: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
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
      itemName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      max: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      baseUnit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      conversionRate: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: 'Inventory',
      tableName: 'Inventories',
    }
  );

  return Inventory;
};
