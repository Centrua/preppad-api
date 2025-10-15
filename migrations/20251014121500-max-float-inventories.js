"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Inventories', 'max', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: null,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Inventories', 'max', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },
};