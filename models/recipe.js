'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Recipe extends Model {
    static associate(models) {
      // Each ingredient in `ingredients` array is tied to Inventories via itemId
      // Not enforced by Sequelize association directly — handled at application level
    }
  }

  Recipe.init({
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
    // Store array of inventory itemIds used as ingredients
    ingredients: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: true,
      defaultValue: [],
    },
    // Quantity of each ingredient (1-to-1 index with `ingredients`)
    ingredientsQuantity: {
      type: DataTypes.ARRAY(DataTypes.FLOAT),
      allowNull: true,
      defaultValue: [],
    },
    // Unit for each ingredient (1-to-1 index with `ingredients`)
    ingredientsUnit: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    categories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    variations: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: true,
      defaultValue: [],
    },
    modifiers: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
  }, {
    sequelize,
    modelName: 'Recipe',
    tableName: 'Recipes',
  });

  return Recipe;
};
