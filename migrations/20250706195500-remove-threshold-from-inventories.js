'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Inventories', 'threshold');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Inventories', 'threshold', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: null,
    });
  },
};
