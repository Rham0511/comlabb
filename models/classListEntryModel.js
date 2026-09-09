import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { LaboratorySchedule } from "./laboratoryScheduleModel.js";

export const ClassListEntry = sequelize.define("ClassListEntry", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  laboratoryScheduleId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  courseSection: {
    type: DataTypes.STRING,
    allowNull: true
  },
  program: {
    type: DataTypes.STRING,
    allowNull: true
  },
  year: {
    type: DataTypes.STRING,
    allowNull: true
  },
  section: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: "class_list_entries",
  timestamps: true
});

LaboratorySchedule.hasMany(ClassListEntry, {
  foreignKey: "laboratoryScheduleId",
  as: "classListEntries"
});

ClassListEntry.belongsTo(LaboratorySchedule, {
  foreignKey: "laboratoryScheduleId",
  as: "laboratorySchedule"
});

export const ensureClassListEntryTable = async () => {
  try {
    await ClassListEntry.sync({ alter: true, logging: false });
    return true;
  } catch (error) {
    console.warn("⚠️ Failed to ensure class_list_entries table exists:", error.message);
    throw error;
  }
};

export { sequelize };