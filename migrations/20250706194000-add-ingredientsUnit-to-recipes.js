"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Recipes", "ingredientsUnit", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Recipes", "ingredientsUnit");
  },
};
