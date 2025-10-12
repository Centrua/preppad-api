"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ShoppingLists", "notes", {
      type: Sequelize.ARRAY(Sequelize.STRING(255)),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ShoppingLists", "notes");
  },
};