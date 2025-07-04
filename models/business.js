'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Business extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Business.init({
    name: DataTypes.STRING,
    squareAccessToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    squareRefreshToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    squareTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    squareMerchantId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
  }, {
    sequelize,
    modelName: 'Business',
  });
  return Business;
};