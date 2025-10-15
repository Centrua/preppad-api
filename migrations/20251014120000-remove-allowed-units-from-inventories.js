"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Inventories', 'allowedUnits');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Inventories', 'allowedUnits', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });
  },
};