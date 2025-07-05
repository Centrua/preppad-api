'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Inventory extends Model {
    static associate(models) {
      Inventory.belongsTo(models.Business, { foreignKey: 'businessId' });
      Inventory.belongsTo(models.Recipe, { foreignKey: 'itemId' });
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
      itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Items',
          key: 'itemId',
        },
        onDelete: 'CASCADE',
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantityInStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      threshold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
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
      modelName: 'Inventory',
      tableName: 'Inventories',
    }
  );

  return Inventory;
};
