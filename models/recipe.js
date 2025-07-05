'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Recipe extends Model {
    static associate(models) {
      // define associations here if needed
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
    modelName: 'Recipe',
  });

  return Recipe;
};
