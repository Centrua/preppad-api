'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PendingPurchases', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      businessId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Businesses',
          key: 'id',
        }
      },
      itemIds: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: false,
      },
      quantities: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: false,
      },
      cheapestUnitPrice: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        allowNull: false,
      },
      vendor: {
        type: DataTypes.ARRAY(DataTypes.STRING(255)),
        allowNull: false,
      },
      totalPrice: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PendingPurchases');
  },
};
