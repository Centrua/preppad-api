'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Recipes', 'ingredientsUnit');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Recipes', 'ingredientsUnit', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });
  }
};
