const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const EquipmentSet = sequelize.define('EquipmentSet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  setName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  campusId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  laboratoryId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Physical location description (e.g., Row 1, Position 3)'
  },
  status: {
    type: DataTypes.ENUM('active', 'maintenance', 'incomplete', 'retired'),
    defaultValue: 'active'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'equipment_sets',
  timestamps: true
});

module.exports = EquipmentSet;
