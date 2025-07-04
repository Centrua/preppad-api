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
      allowNull: false
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
    upc: {
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
    }
  }, {
    sequelize,
    modelName: 'Item',
  });

  return Item;
};
