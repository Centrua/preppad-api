"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("PendingPurchases", "cheapestUnitPrice");
    await queryInterface.removeColumn("PendingPurchases", "vendor");
    await queryInterface.removeColumn("PendingPurchases", "totalPrice");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("PendingPurchases", "cheapestUnitPrice", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn("PendingPurchases", "vendor", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("PendingPurchases", "totalPrice", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },
};
