import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const AuditLog = sequelize.define("AuditLog", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  actorName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  actorRole: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  module: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resourceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userCampus: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: "audit_logs",
  timestamps: true,
  indexes: [
    { fields: ["userId"] },
    { fields: ["action"] },
    { fields: ["module"] }
  ]
});

await AuditLog.sync();
export { sequelize };