'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Items', {
      itemId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false
      },
      itemName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      unitCost: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false
      },
      vendor: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      upc: {
        type: Sequelize.BIGINT
      },
      expirationDate: {
        type: Sequelize.DATE
      },
      unit: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      quantityInStock: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isPerishable: {
        type: Sequelize.CHAR(1),
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('Items');
  }
};
