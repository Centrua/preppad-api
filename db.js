const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();
import pg from 'pg';

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT,
  dialectModule: pg,
});

const Business = sequelize.define('Business', {
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  timestamps: true,
});

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  fullName: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLogin: { type: DataTypes.DATE },
}, {
  timestamps: true,
});

Business.hasMany(User, { foreignKey: 'businessId' });
User.belongsTo(Business, { foreignKey: 'businessId' });

module.exports = { sequelize, Business, User };
