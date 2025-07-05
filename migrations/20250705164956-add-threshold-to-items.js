'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Items', 'threshold', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Items', 'threshold');
  }
};
