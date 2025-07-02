'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Item', {
      itemid: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false
      },
      itemname: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      unitcost: {
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
      expirationdate: {
        type: Sequelize.DATE
      },
      unit: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      quantityinstock: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isperishable: {
        type: Sequelize.CHAR(1),
        allowNull: false
      },
      lastupdated: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('Item');
  }
};
