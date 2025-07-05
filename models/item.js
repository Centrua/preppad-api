'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Item extends Model {
    static associate(models) {
      // define associations here if needed
    }
  }

  Item.init({
    itemId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Businesses',
        key: 'id',
      }
    },
    itemName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    unitCost: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false
    },
    vendor: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    sku: {
      type: DataTypes.BIGINT
    },
    expirationDate: {
      type: DataTypes.DATE
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    quantityInStock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isPerishable: {
      type: DataTypes.CHAR(1),
      allowNull: false
    },
    threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    ingredients: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    ingredientsQuantity: {
      type: DataTypes.ARRAY(DataTypes.FLOAT),
      allowNull: true,
      defaultValue: [],
    },
    ingredientsUnit: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
  }, {
    sequelize,
    modelName: 'Item',
  });

  return Item;
};
