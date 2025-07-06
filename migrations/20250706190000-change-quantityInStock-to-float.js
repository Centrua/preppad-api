"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Inventories", "quantityInStock", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Inventories", "quantityInStock", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
};
