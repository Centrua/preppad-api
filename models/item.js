const { DataTypes } = require('sequelize');
const sequelize = require('./your-sequelize-instance'); // Replace with your actual instance

const Item = sequelize.define('Item', {
  itemid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  itemname: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  unitcost: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false
  },
  vendor: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  upc: {
    type: DataTypes.BIGINT
  },
  expirationdate: {
    type: DataTypes.DATE
  },
  unit: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  quantityinstock: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isperishable: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    validate: {
      isIn: [['Y', 'N']]
    }
  },
  lastupdated: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Item',
  timestamps: false
});

module.exports = Item;
