import { DataTypes } from 'sequelize';
import sequelize from './db.js';

/**
 * EquipmentTechnicianReport Model
 * Weekly reports submitted by technicians
 * Summarizes equipment status, maintenance, and issues
 */
const EquipmentTechnicianReport = sequelize.define('EquipmentTechnicianReport', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    reportId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique report identifier (e.g., TECH-2026-W40)'
    },
    reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date report covers'
    },
    weekNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Week number of year'
    },
    campusId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    laboratoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Specific lab or NULL for entire campus'
    },
    technicianId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Technician who created report'
    },
    technicianName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Cached technician name'
    },
    reportType: {
        type: DataTypes.ENUM('weekly', 'incident', 'maintenance', 'audit'),
        defaultValue: 'weekly'
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Executive summary of the report'
    },
    equipmentIssuesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    maintenancePerformed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    newEquipmentAdded: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    equipmentRetired: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    inventoryCheckCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    inventoryCheckId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Links to inventory check if performed'
    },
    recommendations: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Technician recommendations'
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'File paths or URLs to attachments'
    },
    status: {
        type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'approved'),
        defaultValue: 'draft'
    },
    submittedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reviewedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Admin who reviewed'
    },
    reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reviewComments: {
        type: DataTypes.TEXT,
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
    tableName: 'equipment_technician_reports',
    timestamps: true,
    indexes: [
        { fields: ['reportId'] },
        { fields: ['reportDate'] },
        { fields: ['weekNumber'] },
        { fields: ['campusId'] },
        { fields: ['technicianId'] },
        { fields: ['reportType'] },
        { fields: ['status'] }
    ]
});

export default EquipmentTechnicianReport;
