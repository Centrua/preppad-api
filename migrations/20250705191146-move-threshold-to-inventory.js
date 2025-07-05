'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove threshold from Recipes table
    await queryInterface.removeColumn('Recipes', 'threshold');

    // Add threshold to Inventories table
    await queryInterface.addColumn('Inventories', 'threshold', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    // Add threshold back to Recipes table
    await queryInterface.addColumn('Recipes', 'threshold', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Remove threshold from Inventories table
    await queryInterface.removeColumn('Inventories', 'threshold');
  },
};
