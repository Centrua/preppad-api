'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Inventories', 'itemName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('Inventories', 'itemId');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Inventories', 'itemId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.removeColumn('Inventories', 'itemName');
  },
};