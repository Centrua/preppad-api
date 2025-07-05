'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ShoppingLists', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      businessId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Businesses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
        type: Sequelize.ARRAY(Sequelize.DECIMAL(10, 2)),
        allowNull: false,
      },
      vendor: {
        type: Sequelize.ARRAY(Sequelize.STRING(255)),
        allowNull: false,
      },
      totalPrice: {
        type: Sequelize.ARRAY(Sequelize.DECIMAL(10, 2)),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addConstraint('ShoppingLists', {
      fields: ['businessId'],
      type: 'unique',
      name: 'unique_shopping_list_per_business',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ShoppingLists');
  },
};
