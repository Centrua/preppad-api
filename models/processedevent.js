'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProcessedEvent extends Model {
    static associate(models) {
      // No associations needed unless you want to link to orders or business
    }
  }

  ProcessedEvent.init(
    {
      orderId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    {
      sequelize,
      modelName: 'ProcessedEvent',
      tableName: 'ProcessedEvents',
      timestamps: false,
    }
  );

  return ProcessedEvent;
};
