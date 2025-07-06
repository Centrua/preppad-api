"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Inventories", "unit");
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Inventories", "unit", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
