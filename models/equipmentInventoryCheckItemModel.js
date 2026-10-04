import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

/**
 * EquipmentInventoryCheckItem Model
 * Individual equipment items checked during inventory
 * Child records of EquipmentInventoryCheck
 */
const EquipmentInventoryCheckItem = sequelize.define('EquipmentInventoryCheckItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    inventoryCheckId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Links to parent inventory check'
    },
    equipmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Equipment being checked'
    },
    serialNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Serial number being checked'
    },
    expectedLocation: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Where equipment should be'
    },
    actualLocation: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Where equipment was found'
    },
    status: {
        type: DataTypes.ENUM('found', 'missing', 'damaged', 'misplaced'),
        allowNull: false
    },
    conditionBefore: {
        type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'broken'),
        allowNull: true
    },
    conditionAfter: {
        type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'broken'),
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes about this specific item'
    },
    checkedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'equipment_inventory_check_items',
    timestamps: false,
    indexes: [
        { fields: ['inventoryCheckId'] },
        { fields: ['equipmentId'] },
        { fields: ['serialNumber'] },
        { fields: ['status'] }
    ]
});

export default EquipmentInventoryCheckItem;
