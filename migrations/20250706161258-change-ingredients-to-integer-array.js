'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the default first
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" DROP DEFAULT;
    `);
    // Change the type
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" TYPE integer[]
      USING ingredients::integer[];
    `);
    // Set new default if you want (optional)
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" SET DEFAULT ARRAY[]::integer[];
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the default first
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" DROP DEFAULT;
    `);
    // Change the type back
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" TYPE character varying[]
      USING ingredients::varchar[];
    `);
    // Set old default (optional)
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recipes"
      ALTER COLUMN "ingredients" SET DEFAULT ARRAY[]::character varying[];
    `);
  }
};