'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('Items', 'Recipes');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('Recipes', 'Items');
  },
};
