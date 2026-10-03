import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

/**
 * MissingEquipmentHistory Model
 * Full audit trail for equipment reported as missing or found.
 * Equipment stays linked to its original setId even when missing.
 */
export const MissingEquipmentHistory = sequelize.define("MissingEquipmentHistory", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "FK to equipment.id"
  },
  equipmentCode: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: "equipment.equipmentId string for quick reference"
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "Serial number at time of report"
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: "Original set ID — preserved even if missing"
  },
  campus: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  laboratoryRoom: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Last known physical location"
  },
  eventType: {
    type: DataTypes.ENUM("reported_missing", "found", "transferred"),
    allowNull: false
  },
  reportedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "User ID who reported"
  },
  reportedByName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Cached name for display"
  },
  reportedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Reason or notes for this event"
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "When marked as found"
  },
  resolvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resolvedByName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "missing_equipment_history",
  timestamps: true,
  indexes: [
    { fields: ["equipmentId"] },
    { fields: ["equipmentCode"] },
    { fields: ["serialNumber"] },
    { fields: ["setId"] },
    { fields: ["campus"] },
    { fields: ["eventType"] },
    { fields: ["reportedAt"] }
  ]
});

export { sequelize };
