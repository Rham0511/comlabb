/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

import { DataTypes, Op } from "sequelize";
import { MaintenanceRequest, sequelize } from "../models/maintenanceRequestModel.js";
import { User } from "../models/userModel.js";
import { Equipment } from "../models/equipmentModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { LaboratorySchedule } from "../models/laboratoryScheduleModel.js";
import { deriveAttendanceStatusFromRecord } from "./attendanceController.js";
import { logAuditEntry } from "./auditController.js";
import { getUserCampusFromSession, canManageRecord } from "./campusAuthController.js";

const normalizeStatus = (status) => {
  const normalized = (status || "").toString().trim();
  if (!normalized) return "Pending";

  const value = normalized.toLowerCase();
  if (["pending", "new"].includes(value)) return "Pending";
  if (["under repair", "in progress", "in-progress", "repair", "working"].includes(value)) return "In Progress";
  if (["fixed", "resolved", "done", "complete"].includes(value)) return "Resolved";
  if (["rejected", "declined", "cancelled", "canceled"].includes(value)) return "Rejected";
  return normalized;
};

const ensureMaintenanceRequestColumns = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable("maintenance_requests");

    if (!tableDefinition.resolvedBy) {
      await queryInterface.addColumn("maintenance_requests", "resolvedBy", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (tableDefinition.status) {
      try {
        await queryInterface.changeColumn("maintenance_requests", "status", {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "Pending"
        });
      } catch (changeError) {
        try {
          await sequelize.query('ALTER TABLE maintenance_requests MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT "Pending"');
        } catch (sqlError) {
          console.warn("Status column could not be altered via SQL fallback:", sqlError.message);
        }
      }
    }
  } catch (error) {
    console.warn("Unable to ensure maintenance request columns:", error.message);
  }
};

const ensureMaintenanceTables = async () => {
  await Promise.all([
    User.sync({ force: false, alter: false, logging: false }),
    Equipment.sync({ force: false, alter: false, logging: false }),
    MaintenanceRequest.sync({ force: false, alter: false, logging: false })
  ]);
};

const normalizeStudentIdentifiers = (student) => {
  const ids = new Set();
  [student?.student_number, student?.studentId, student?.student_id, student?.id].forEach((value) => {
    const normalized = String(value || "").trim();
    if (normalized) ids.add(normalized);
  });
  return Array.from(ids);
};

const getDayOfWeekName = (date = new Date()) => {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[date.getDay()] || "";
};

// Local canonical room map (kept here to avoid cross-file coupling)
const CANONICAL_ROOM_MAP = {
  'room 202': 'Laboratory 1 — Room 202',
  'room202': 'Laboratory 1 — Room 202',
  'rm 202': 'Laboratory 1 — Room 202',
  'rm202': 'Laboratory 1 — Room 202',
  'laboratory 1': 'Laboratory 1 — Room 202',
  'lab 1': 'Laboratory 1 — Room 202',
  'lab1': 'Laboratory 1 — Room 202',
  'laboratory1': 'Laboratory 1 — Room 202',
  'room 204': 'Laboratory 2 — Room 204',
  'room204': 'Laboratory 2 — Room 204',
  'rm 204': 'Laboratory 2 — Room 204',
  'rm204': 'Laboratory 2 — Room 204',
  'laboratory 2': 'Laboratory 2 — Room 204',
  'lab 2': 'Laboratory 2 — Room 204',
  'lab2': 'Laboratory 2 — Room 204',
  'laboratory2': 'Laboratory 2 — Room 204'
};

const normalizeRoomLocal = (value) => {
  if (!value && value !== '') return null;
  const key = String(value || '').trim().toLowerCase();
  if (CANONICAL_ROOM_MAP[key]) return CANONICAL_ROOM_MAP[key];
  // If already canonical
  for (const v of Object.values(CANONICAL_ROOM_MAP)) if (String(v).toLowerCase() === key) return v;
  return String(value || '').trim();
};

const parseScheduleClockTime = (value, referenceDate = new Date()) => {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i);
  if (!match) {
    const fallback = Number(text);
    if (!Number.isNaN(fallback)) {
      const date = new Date(referenceDate);
      date.setHours(0, fallback, 0, 0);
      return date;
    }
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hours === 12) hours = 0;
  if (meridiem === "PM" && hours !== 12) hours += 12;

  const date = new Date(referenceDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getScheduleAttendanceWindow = (schedule, referenceDate = new Date()) => {
  if (!schedule) return null;

  const startTime = parseScheduleClockTime(schedule.startTime, referenceDate);
  const rawEndTime = parseScheduleClockTime(schedule.endTime, referenceDate);
  if (!startTime || !rawEndTime) return null;

  const endTime = new Date(rawEndTime);
  if (endTime.getTime() <= startTime.getTime()) {
    endTime.setTime(endTime.getTime() + 24 * 60 * 60000);
  }

  return { startTime, endTime };
};

const findRelevantScheduleForRoom = async (laboratoryRoom, now = new Date()) => {
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const candidateDays = [getDayOfWeekName(today), getDayOfWeekName(yesterday)];
  const schedules = await LaboratorySchedule.findAll({
    where: {
      laboratoryRoom,
      dayOfWeek: { [Op.in]: candidateDays }
    },
    order: [["startTime", "ASC"]]
  });

  const candidates = schedules
    .map((schedule) => {
      const scheduleDay = schedule.dayOfWeek;
      const scheduleDate = scheduleDay === getDayOfWeekName(yesterday) ? yesterday : today;
      const window = getScheduleAttendanceWindow(schedule, scheduleDate);
      return window ? { schedule, window, scheduleDate } : null;
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  return candidates.find(({ window }) => now >= window.startTime && now < window.endTime) || null;
};

const getStudentAttendanceStatusForEquipment = async (student, equipmentId) => {
  const equipmentIdentifier = String(equipmentId || "").trim();
  const rejectionMessage = "You must be marked PRESENT or LATE for the laboratory session before reporting damaged equipment.";

  if (!student) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Invalid",
      attendanceMessage: rejectionMessage
    };
  }

  if (!equipmentIdentifier) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Invalid",
      attendanceMessage: "Enter an equipment ID to verify your attendance for this laboratory session."
    };
  }

  const equipment = await Equipment.findOne({
    where: { equipmentId: equipmentIdentifier }
  });

  if (!equipment) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Invalid",
      attendanceMessage: "Equipment not found. Please enter a valid equipment ID."
    };
  }

  const studentCampus = String(student.campus || "").trim();
  const equipmentCampus = String(equipment.campus || "").trim();
  if (studentCampus && equipmentCampus && !canManageRecord(studentCampus, equipmentCampus)) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Invalid",
      attendanceMessage: `Report Not Allowed: This equipment belongs to another campus. You can only report equipment from ${studentCampus} Campus.`
    };
  }

  const studentIds = normalizeStudentIdentifiers(student);
  if (!studentIds.length) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Invalid",
      attendanceMessage: rejectionMessage
    };
  }

  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10);
  const scheduleMatches = await LaboratorySchedule.findAll({
    where: {
      campus: { [Op.or]: [studentCampus, `${studentCampus} Campus`, equipmentCampus, `${equipmentCampus} Campus`] },
      dayOfWeek: getDayOfWeekName(now)
    },
    order: [["startTime", "ASC"]]
  });

  const currentSessionMatch = await Promise.all(scheduleMatches.map(async (schedule) => {
    const window = getScheduleAttendanceWindow(schedule, now);
    if (!window) return null;
    if (!(now >= window.startTime && now < window.endTime)) return null;

    const attendanceRecord = await Attendance.findOne({
      where: {
        studentId: { [Op.in]: studentIds },
        date: todayDate,
        status: { [Op.in]: ["Present", "Late"] },
        [Op.or]: [
          { laboratoryScheduleId: schedule.id },
          { lab: normalizeRoomLocal(schedule.laboratoryRoom) },
          { lab: schedule.laboratoryRoom }
        ]
      },
      order: [["createdAt", "DESC"], ["id", "DESC"]]
    });

    if (!attendanceRecord) return null;
    return { schedule, attendanceRecord };
  }));

  const activeSession = currentSessionMatch.find(Boolean);
  if (activeSession) {
    return {
      canSubmitReport: true,
      attendanceStatus: activeSession.attendanceRecord.status,
      attendanceMessage: `Equipment: ${equipment.name} (${equipment.equipmentId}) | Campus: ${equipment.campus} | Status: ${equipment.status || 'Available'} | Report Status: Allowed`,
      equipmentMeta: {
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        campus: equipment.campus,
        status: equipment.status || "Available",
        reportStatus: "Allowed"
      }
    };
  }

  const sameDayAttendance = await Attendance.findOne({
    where: {
      studentId: { [Op.in]: studentIds },
      date: todayDate,
      status: { [Op.in]: ["Present", "Late"] }
    },
    order: [["createdAt", "DESC"], ["id", "DESC"]]
  });

  if (sameDayAttendance) {
    return {
      canSubmitReport: false,
      attendanceStatus: "Present",
      attendanceMessage: "Report Not Allowed: Damage reports can only be submitted during your active laboratory session.",
      equipmentMeta: {
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        campus: equipment.campus,
        status: equipment.status || "Available",
        reportStatus: "Not Allowed"
      }
    };
  }

  const anyAttendance = await Attendance.findOne({
    where: {
      studentId: { [Op.in]: studentIds },
      date: todayDate
    },
    order: [["createdAt", "DESC"], ["id", "DESC"]]
  });

  if (anyAttendance) {
    return {
      canSubmitReport: false,
      attendanceStatus: String(anyAttendance.status || "Absent"),
      attendanceMessage: rejectionMessage,
      equipmentMeta: {
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        campus: equipment.campus,
        status: equipment.status || "Available",
        reportStatus: "Not Allowed"
      }
    };
  }

  return {
    canSubmitReport: false,
    attendanceStatus: "Absent",
    attendanceMessage: `Report Not Allowed: ${rejectionMessage}`,
    equipmentMeta: {
      equipmentId: equipment.equipmentId,
      name: equipment.name,
      campus: equipment.campus,
      status: equipment.status || "Available",
      reportStatus: "Not Allowed"
    }
  };
};

const getStudentMaintenanceContext = async (req, equipmentId = null) => {
  if (!req.session?.userId) return null;

  await ensureMaintenanceTables();

  let student = null;
  let equipment = [];

  try {
    student = await User.findByPk(req.session.userId, {
      attributes: ["id", "name", "student_number", "campus", "role", "email"]
    });
  } catch (error) {
    console.warn("Unable to load student profile for maintenance context:", error.message);
  }

  try {
    const equipmentRows = await Equipment.findAll({
      order: [["name", "ASC"]]
    });
    equipment = equipmentRows.map((item) => ({
      equipmentId: item.equipmentId,
      name: item.name
    }));
  } catch (error) {
    console.warn("Unable to load equipment list for maintenance context:", error.message);
  }

  const studentIdentifier = student?.student_number || String(req.session.userId);
  const attendanceContext = await getStudentAttendanceStatusForEquipment(student, equipmentId);

  return {
    student,
    studentId: studentIdentifier,
    studentName: student?.name || "Student",
    equipment,
    ...attendanceContext
  };
};

export const getStudentMaintenanceContextRoute = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const equipmentId = String(req.query.equipmentId || req.query.equipment_id || "").trim();

  try {
    const context = await getStudentMaintenanceContext(req, equipmentId);
    const equipmentMeta = context?.equipmentMeta || null;

    return res.json({
      success: true,
      studentId: context?.studentId || null,
      studentName: context?.studentName || null,
      equipment: context?.equipment || [],
      equipmentMeta,
      canSubmitReport: context?.canSubmitReport || false,
      attendanceStatus: context?.attendanceStatus || "Invalid",
      attendanceMessage: context?.attendanceMessage || "You must be marked PRESENT or LATE for the laboratory session before reporting damaged equipment."
    });
  } catch (error) {
    console.error("Failed to load student maintenance context:", error);
    return res.status(500).json({ error: "Unable to load equipment." });
  }
};

export const createMaintenanceRequest = async (req, res) => {
  const { equipmentId, equipment_id, description, damageDescription, issueTitle, category, priority } = req.body;
  const resolvedEquipmentId = equipmentId || equipment_id;
  const resolvedDescription = (description || damageDescription || "").toString().trim();

  if (!resolvedEquipmentId || !resolvedDescription) {
    return res.status(400).json({ error: "Equipment and damage description are required." });
  }

  try {
    console.log('[maintenance] report creation request');
    await ensureMaintenanceTables();
    await ensureMaintenanceRequestColumns();

    const studentContext = await getStudentMaintenanceContext(req);
    let student = null;

    try {
      student = await User.findByPk(req.session?.userId, {
        attributes: ["id", "name", "student_number", "campus", "role", "email"]
      });
    } catch (error) {
      console.warn("Unable to load student record while creating maintenance request:", error.message);
    }

    const equipment = await Equipment.findOne({ where: { equipmentId: resolvedEquipmentId } });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found." });
    }

    const studentCampus = String((student?.campus || studentContext?.student?.campus || "").trim());
    if (studentCampus && String(equipment.campus || "").trim() && !canManageRecord(studentCampus, equipment.campus)) {
      return res.status(403).json({
        error: `Report Not Allowed: This equipment belongs to another campus. You can only report equipment from ${studentCampus} Campus.`
      });
    }

    const attendanceCheck = await getStudentAttendanceStatusForEquipment(student || studentContext?.student, resolvedEquipmentId);
    if (!attendanceCheck.canSubmitReport) {
      return res.status(403).json({
        error: attendanceCheck.attendanceMessage || "You must be marked PRESENT or LATE for the laboratory session before reporting damaged equipment."
      });
    }

    const equipmentCampus = equipment?.campus || "Main";
    const maintenance = await MaintenanceRequest.create({
      student_id: req.session?.userId || null,
      student_name: student?.name || studentContext?.studentName || null,
      equipment_id: resolvedEquipmentId,
      laboratory_id: null,
      subject_id: null,
      instructor_id: null,
      laboratory_room: equipment?.laboratoryRoom || null,
      subject: null,
      instructor: null,
      equipmentId: resolvedEquipmentId,
      reportedBy: req.session?.userId || null,
      campus: equipmentCampus,
      issueTitle: (issueTitle && issueTitle.trim()) || `Equipment damage: ${resolvedEquipmentId}`,
      description: resolvedDescription,
      category: (category && category.trim()) || "Equipment Damage",
      priority: priority || "Medium",
      status: "Pending",
      dateReported: new Date()
    });

    try {
      const total = await MaintenanceRequest.count({ where: { equipmentId: resolvedEquipmentId, description: resolvedDescription } });
      console.log('[maintenance] created report ID', maintenance.id);
      console.log('[maintenance] total records inserted', total);
    } catch (countErr) {
      console.log('[maintenance] created report ID', maintenance.id);
      console.warn('[maintenance] unable to count similar records:', countErr.message);
    }

    await logAuditEntry(req, {
      action: "Maintenance Request Created",
      module: "Maintenance Monitoring",
      resourceId: maintenance.id,
      description: `Maintenance request created for equipment ${resolvedEquipmentId}.`,
      details: {
        maintenanceId: maintenance.id,
        equipmentId: resolvedEquipmentId,
        issueTitle: maintenance.issueTitle,
        reportedBy: req.session?.userId || null
      }
    });

    return res.status(201).json({
      success: true,
      message: "Equipment report submitted successfully.",
      data: maintenance
    });
  } catch (error) {
    console.error("Failed to create maintenance request:", error);
    return res.status(500).json({
      error: "Failed to create maintenance request.",
      details: error.message || "Unknown error"
    });
  }
};

const buildMaintenanceWhereClause = (req, extra = {}) => {
  const role = req.session?.userRole?.toLowerCase();
  const userId = req.session?.userId;
  const userCampus = req.session?.userCampus;
  const whereClause = { ...extra };

  // Normalize the user campus before filtering so campus aliases like
  // "Bongabong" and "Bongabong Campus" match the stored report campus values.
  if (userCampus) {
    const aliases = new Set();
    const values = [String(userCampus).trim()];
    values.forEach((value) => {
      if (!value) return;
      aliases.add(value);
      const noCampus = value.replace(/\s*campus\s*$/i, '').trim();
      if (noCampus) aliases.add(noCampus);
      if (noCampus) aliases.add(`${noCampus} Campus`);
      if (value !== noCampus) aliases.add(value.replace(/\s*campus\s*$/i, '').trim());
    });

    const campusValues = Array.from(aliases).filter(Boolean);
    if (campusValues.length) {
      whereClause.campus = { [Op.in]: campusValues };
    }
  }

  if (role === "technician") {
    return whereClause;
  }

  if (role === "student") {
    whereClause[Op.or] = [
      { student_id: userId },
      { reportedBy: userId }
    ];
  }

  return whereClause;
};

export const getAllMaintenanceRequests = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { status, priority, equipmentId, unassigned } = req.query;

  try {
    await ensureMaintenanceTables();
    await ensureMaintenanceRequestColumns();

    const whereClause = buildMaintenanceWhereClause(req);

    if (priority) whereClause.priority = priority;
    if (equipmentId) whereClause.equipmentId = equipmentId;
    if (unassigned === "true") whereClause.assignedTo = null;

    const records = await MaintenanceRequest.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "name", "email"]
        },
        {
          model: User,
          as: "technician",
          attributes: ["id", "name", "email"]
        },
        {
          model: Equipment,
          as: "equipment",
          attributes: ["equipmentId", "name", "campus", "status"]
        }
      ]
    });

    console.log('[maintenance] dashboard query result count', Array.isArray(records) ? records.length : 0);

    // Deduplicate by primary key in case JOINs or unexpected relations produced duplicate rows
    const uniqueMap = new Map();
    (records || []).forEach((r) => {
      const id = r && (r.id || (r.toJSON && r.toJSON().id));
      if (id != null && !uniqueMap.has(id)) uniqueMap.set(id, r);
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    console.log('[maintenance] unique report IDs', uniqueRecords.map(r => r.id));

    const filtered = uniqueRecords.filter((record) => {
      const currentStatus = normalizeStatus(record.status);
      if (status) return currentStatus === normalizeStatus(status);
      return true;
    });

    const pendingCount = filtered.filter(r => normalizeStatus(r.status) === 'Pending').length;
    console.log('[maintenance] pending count', pendingCount);

    const formatted = filtered.map((record) => {
      const data = record.toJSON();
      const normalizedStatus = normalizeStatus(data.status);
      const timestamp = data.created_at || data.createdAt || data.dateReported;
      const equipmentStatus = data.equipment?.status || data.equipmentStatus || "Serviceable";
      const recordCampus = data.campus || data.equipment?.campus || null;

      return {
        ...data,
        status: normalizedStatus,
        campus: recordCampus,
        equipmentStatus,
        reporterName: data.reporter?.name || data.student_name || "Guest Student",
        reporterEmail: data.reporter?.email || null,
        technicianName: data.technician?.name || null,
        technicianEmail: data.technician?.email || null,
        equipmentName: data.equipment?.name || data.equipment_id || "Unknown Equipment",
        equipmentId: data.equipment_id || data.equipmentId || null,
        resolvedBy: data.resolvedBy || null,
        resolvedDate: data.dateResolved || null,
        dateReported: data.dateReported || data.created_at || data.createdAt || null,
        date: timestamp
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error("Failed to load maintenance requests:", error);
    return res.status(500).json({ error: "Failed to load maintenance requests." });
  }
};

export const getMaintenanceRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureMaintenanceTables();
    await ensureMaintenanceRequestColumns();

    const maintenance = await MaintenanceRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "name", "email"]
        },
        {
          model: User,
          as: "technician",
          attributes: ["id", "name", "email"]
        },
        {
          model: Equipment,
          as: "equipment",
          attributes: ["equipmentId", "name", "campus", "status"]
        }
      ]
    });

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    // Campus-based authorization check
    const userCampus = req.session?.userCampus;
    if (userCampus && maintenance.campus && !canManageRecord(userCampus, maintenance.campus)) {
      return res.status(403).json({ error: "You do not have permission to view this maintenance request." });
    }

    const data = maintenance.toJSON();
    return res.json({
      ...data,
      status: normalizeStatus(data.status),
      campus: data.campus || data.equipment?.campus || null,
      equipmentStatus: data.equipment?.status || "Serviceable",
      reporterName: data.reporter?.name || data.student_name || "Guest Student",
      technicianName: data.technician?.name || null,
      equipmentName: data.equipment?.name || data.equipment_id || "Unknown Equipment"
    });
  } catch (error) {
    console.error("Failed to retrieve maintenance request:", error);
    return res.status(500).json({ error: "Failed to retrieve maintenance request." });
  }
};

export const updateMaintenanceStatus = async (req, res) => {
  const { id } = req.params;
  const { status, resolvedBy } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }

  const normalizedStatus = normalizeStatus(status);
  const validStatuses = ["Pending", "In Progress", "Resolved", "Rejected"];
  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    await ensureMaintenanceTables();
    await ensureMaintenanceRequestColumns();

    const maintenance = await MaintenanceRequest.findByPk(id);

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) {
      return res.status(403).json({ error: "Unauthorized: User campus not found." });
    }

    // User can only update maintenance requests from their own campus
    if (!canManageRecord(userCampus, maintenance.campus)) {
      return res.status(403).json({ error: "You do not have permission to update maintenance requests from another campus." });
    }

    const updateData = { status: normalizedStatus };

    if (normalizedStatus === "Resolved") {
      updateData.dateResolved = new Date();
      updateData.resolvedBy = resolvedBy || req.session?.user?.name || req.session?.userName || "Technician";
    }

    try {
      await maintenance.update(updateData);
    } catch (updateError) {
      console.warn("Model update failed, retrying with direct SQL:", updateError.message);
      await ensureMaintenanceRequestColumns();
      await sequelize.query(
        `UPDATE maintenance_requests SET status = ?, dateResolved = ?, resolvedBy = ? WHERE id = ?`,
        {
          replacements: [
            normalizedStatus,
            updateData.dateResolved ? updateData.dateResolved.toISOString() : null,
            updateData.resolvedBy || null,
            id
          ],
          type: sequelize.QueryTypes.UPDATE
        }
      );
    }

    const refreshedMaintenance = await MaintenanceRequest.findByPk(id);
    await logAuditEntry(req, {
      action: "Maintenance Status Updated",
      module: "Maintenance Monitoring",
      resourceId: id,
      description: `Maintenance request ${id} status changed to ${normalizedStatus}.`,
      details: {
        status: normalizedStatus,
        resolvedBy: updateData.resolvedBy || null,
        campus: maintenance.campus
      }
    });

    return res.json({
      success: true,
      message: "Maintenance request status updated successfully.",
      data: refreshedMaintenance
    });
  } catch (error) {
    console.error("Failed to update maintenance status:", error);
    return res.status(500).json({ error: "Failed to update maintenance request." });
  }
};

export const assignTechnician = async (req, res) => {
  if (!req.session?.userId || req.session.userRole?.toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Forbidden: only admin may assign technicians." });
  }

  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ error: "Technician ID is required." });
  }

  try {
    const maintenance = await MaintenanceRequest.findByPk(id);

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    await maintenance.update({
      assignedTo,
      status: "In Progress"
    });
    await logAuditEntry(req, {
      action: "Technician Assigned",
      module: "Maintenance Monitoring",
      resourceId: id,
      description: `Technician ${assignedTo} assigned to maintenance request ${id}.`,
      details: { assignedTo }
    });

    return res.json({
      success: true,
      message: "Technician assigned successfully.",
      data: maintenance
    });
  } catch (error) {
    console.error("Failed to assign technician:", error);
    return res.status(500).json({ error: "Failed to assign technician." });
  }
};

export const getMaintenanceSummary = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const whereClause = buildMaintenanceWhereClause(req);

    const allRequests = await MaintenanceRequest.findAll({ where: whereClause, attributes: ["id", "status"] });
    console.log('[maintenance] dashboard query result count', Array.isArray(allRequests) ? allRequests.length : 0);

    // Deduplicate by id then compute status counts
    const uniq = new Map();
    (allRequests || []).forEach(r => {
      const id = r && (r.id || (r.toJSON && r.toJSON().id));
      if (id != null && !uniq.has(id)) uniq.set(id, r);
    });
    const uniqueList = Array.from(uniq.values());
    console.log('[maintenance] unique report IDs', uniqueList.map(r => r.id));

    const counts = {
      totalRequests: uniqueList.length,
      pendingRequests: uniqueList.filter((request) => normalizeStatus(request.status) === "Pending").length,
      inProgressRequests: uniqueList.filter((request) => normalizeStatus(request.status) === "In Progress").length,
      resolvedRequests: uniqueList.filter((request) => normalizeStatus(request.status) === "Resolved").length
    };
    console.log('[maintenance] pending count', counts.pendingRequests);

    const totalStudents = await User.count({ where: { role: "student" } });
    const totalTechnicians = await User.count({ where: { role: "technician" } });

    return res.json({
      ...counts,
      totalStudents,
      totalTechnicians
    });
  } catch (error) {
    console.error("Failed to load maintenance summary:", error);
    return res.status(500).json({ error: "Failed to load maintenance summary." });
  }
};

export const getTechnicianActivities = async (req, res) => {
  if (!req.session?.userId || req.session.userRole?.toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const technicians = await User.findAll({ where: { role: "technician" }, attributes: ["id", "name", "email"] });
    const activityData = await Promise.all(technicians.map(async (tech) => {
      const assignedRequests = await MaintenanceRequest.findAll({ where: { assignedTo: tech.id } });
      const inProgressTasks = assignedRequests.filter((request) => normalizeStatus(request.status) === "In Progress").length;
      const resolvedTasks = assignedRequests.filter((request) => normalizeStatus(request.status) === "Resolved").length;
      const latestRequest = assignedRequests.sort((left, right) => new Date(right.created_at || right.createdAt || right.dateReported) - new Date(left.created_at || left.createdAt || left.dateReported))[0];

      return {
        technicianName: tech.name,
        assignedRequestsCount: assignedRequests.length,
        inProgressTasks,
        resolvedTasks,
        lastActivityDate: latestRequest ? (latestRequest.dateResolved || latestRequest.created_at || latestRequest.createdAt || latestRequest.dateReported) : null
      };
    }));

    return res.json(activityData);
  } catch (error) {
    console.error("Failed to load technician activities:", error);
    return res.status(500).json({ error: "Failed to load technician activities." });
  }
};

export const deleteMaintenanceRequest = async (req, res) => {
  const { id } = req.params;

  if (!req.session?.userId || req.session.userRole?.toLowerCase() !== "technician" && req.session.userRole?.toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const removed = await MaintenanceRequest.destroy({ where: { id } });

    if (!removed) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }
    await logAuditEntry(req, {
      action: "Maintenance Request Deleted",
      module: "Maintenance Monitoring",
      resourceId: id,
      description: `Maintenance request ${id} was deleted.`,
      details: { requestId: id }
    });

    return res.json({
      success: true,
      message: "Maintenance request deleted successfully."
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete maintenance request." });
  }
};
