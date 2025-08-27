// models/shoppinglist.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShoppingList extends Model {
    static associate(models) {
      // Associate ShoppingList with Business
      ShoppingList.belongsTo(models.Business, {
        foreignKey: 'businessId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  ShoppingList.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      businessId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      itemIds: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false,
      },
      quantities: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
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
      modelName: 'ShoppingList',
      tableName: 'ShoppingLists',
      timestamps: true,
    }
  );

  return ShoppingList;
};
