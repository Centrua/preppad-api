'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Items', 'ingredients', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn('Items', 'ingredientsQuantity', {
      type: Sequelize.ARRAY(Sequelize.FLOAT),
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn('Items', 'ingredientsUnit', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Items', 'ingredients');
    await queryInterface.removeColumn('Items', 'ingredientsQuantity');
    await queryInterface.removeColumn('Items', 'ingredientsUnit');
  },
};
