'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.removeColumn('Recipes', 'vendor'),
      queryInterface.removeColumn('Recipes', 'sku'),
      queryInterface.removeColumn('Recipes', 'expirationDate'),
      queryInterface.removeColumn('Recipes', 'unit'),
      queryInterface.removeColumn('Recipes', 'quantityInStock'),
      queryInterface.removeColumn('Recipes', 'isPerishable'),
    ]);
  },

  async down(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn('Recipes', 'vendor', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Recipes', 'sku', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Recipes', 'expirationDate', {
        type: Sequelize.DATE,
      }),
      queryInterface.addColumn('Recipes', 'unit', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Recipes', 'quantityInStock', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      }),
      queryInterface.addColumn('Recipes', 'isPerishable', {
        type: Sequelize.ENUM('Y', 'N'),
        defaultValue: 'N',
      }),
    ]);
  },
};
