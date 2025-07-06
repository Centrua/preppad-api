'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ShoppingLists', 'cheapestUnitPrice');
    await queryInterface.removeColumn('ShoppingLists', 'vendor');
    await queryInterface.removeColumn('ShoppingLists', 'totalPrice');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ShoppingLists', 'cheapestUnitPrice', {
      type: Sequelize.ARRAY(Sequelize.DECIMAL(10, 2)),
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn('ShoppingLists', 'vendor', {
      type: Sequelize.ARRAY(Sequelize.STRING(255)),
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn('ShoppingLists', 'totalPrice', {
      type: Sequelize.ARRAY(Sequelize.DECIMAL(10, 2)),
      allowNull: false,
      defaultValue: [],
    });
  }
};