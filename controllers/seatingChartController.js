import { sequelize } from "../models/db.js";
import { QueryTypes } from "sequelize";

/**
 * Get seating chart for a specific laboratory schedule session
 * Shows which students ACTUALLY ATTENDED and which PCs they're using
 * Based on real attendance records, not theoretical class enrollment
 */
export async function getScheduleSeatingChart(req, res) {
  const { scheduleId } = req.params;

  try {
    // 1. Get schedule details
    const scheduleRows = await sequelize.query(
      `SELECT 
        id,
        subject,
        dayOfWeek,
        startTime,
        endTime,
        laboratoryRoom,
        instructor,
        campus
      FROM laboratory_schedules
      WHERE id = ?`,
      {
        replacements: [scheduleId],
        type: QueryTypes.SELECT
      }
    );

    if (scheduleRows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const schedule = scheduleRows[0];

    // 2. Get all students who ACTUALLY ATTENDED this schedule session (not just enrolled)
    // This shows real attendance, not theoretical class roster
    const students = await sequelize.query(
      `SELECT DISTINCT
        a.id as attendanceId,
        u.id as studentId,
        a.fullName as fullName,
        u.email,
        a.timeIn,
        a.status
      FROM attendance a
      LEFT JOIN users u ON u.student_number = a.studentId
      WHERE a.laboratoryScheduleId = ?
      ORDER BY a.fullName`,
      {
        replacements: [scheduleId],
        type: QueryTypes.SELECT
      }
    );

    // 3. Get PC equipment sets for this schedule's laboratory
    // Use fuzzy matching for laboratory room names
    const labRoomPattern = schedule.laboratoryRoom
      .replace(/Laboratory\s+(\d+).*/, 'Laboratory $1%')
      .replace(/Computer Lab\s+(\d+).*/, 'Computer Lab $1%');
    
    const pcSets = await sequelize.query(
      `SELECT 
        es.setId,
        es.setName,
        es.location,
        es.status as setStatus,
        GROUP_CONCAT(
          CONCAT(e.category, ': ', COALESCE(e.name, 'N/A'), ' (SN: ', COALESCE(e.serialNumber, 'N/A'), ')')
          ORDER BY FIELD(e.category, 'CPU', 'Monitor', 'Keyboard', 'Mouse', 'AVR', 'Other')
          SEPARATOR ' | '
        ) as components,
        COUNT(e.id) as componentCount
      FROM equipment_sets es
      LEFT JOIN equipment e ON BINARY es.setId = BINARY e.setId 
        AND e.status = 'Serviceable'
        AND e.campus LIKE ?
        AND (e.laboratoryRoom LIKE ? OR e.laboratoryRoom LIKE ?)
      WHERE es.status = 'active'
      GROUP BY es.setId, es.setName, es.location, es.status
      HAVING componentCount > 0
      ORDER BY es.setId`,
      { 
        replacements: [
          `%${schedule.campus.replace(' Campus', '')}%`,
          `%Laboratory 1%`,
          `%Computer Lab 1%`
        ],
        type: QueryTypes.SELECT 
      }
    );

    // 4. Get PC assignments ONLY for students enrolled in this schedule
    // Must have attendance record linked to this schedule
    const assignments = await sequelize.query(
      `SELECT 
        eul.id,
        eul.userId,
        eul.equipmentId,
        eul.serialNumber,
        eul.usageStartTime,
        eul.usageEndTime,
        eul.attendanceId,
        e.setId,
        u.name as fullName,
        a.laboratoryScheduleId
      FROM equipment_usage_logs eul
      JOIN users u ON eul.userId = u.id
      JOIN equipment e ON eul.equipmentId = e.id
      JOIN attendance a ON eul.attendanceId = a.id
      WHERE e.setId IS NOT NULL
        AND eul.usageEndTime IS NULL
        AND a.laboratoryScheduleId = ?
      ORDER BY eul.usageStartTime DESC`,
      {
        replacements: [scheduleId],
        type: QueryTypes.SELECT
      }
    );

    // 5. Map assignments to PC sets
    // Build a map of PC assignments (setId -> assignment)
    const pcAssignmentMap = {};
    assignments.forEach((assignment) => {
      if (assignment.setId && !pcAssignmentMap[assignment.setId]) {
        pcAssignmentMap[assignment.setId] = assignment;
      }
    });

    // 6. Build seating chart data structure
    const seatingChart = pcSets.map((pc) => {
      const assignment = pcAssignmentMap[pc.setId];

      return {
        setId: pc.setId,
        setName: pc.setName,
        location: pc.location,
        setStatus: pc.setStatus,
        components: pc.components,
        componentCount: pc.componentCount,
        status: assignment ? "occupied" : "available",
        student: assignment
          ? {
              id: assignment.userId,
              fullName: assignment.fullName,
              email: '', // Email not in usage logs
              startTime: assignment.usageStartTime,
              isActive: assignment.usageEndTime === null,
            }
          : null,
      };
    });

    // 7. Get list of students who ATTENDED but are NOT assigned to any PC
    const assignedUserIds = new Set(assignments.map(a => a.userId));
    const unassignedStudents = students.filter(
      (s) => !assignedUserIds.has(s.studentId)
    );

    // 8. Return comprehensive seating chart with ACTUAL ATTENDANCE stats
    res.json({
      schedule: {
        id: schedule.id,
        subject: schedule.subject,
        day: schedule.dayOfWeek,
        time: `${schedule.startTime} - ${schedule.endTime}`,
        room: schedule.laboratoryRoom,
        instructor: schedule.instructor,
        campus: schedule.campus,
      },
      seatingChart,
      statistics: {
        totalPCs: pcSets.length,
        occupiedPCs: seatingChart.filter((pc) => pc.status === "occupied").length,
        availablePCs: seatingChart.filter((pc) => pc.status === "available").length,
        totalStudents: students.length, // Students who actually attended this session
        assignedStudents: students.length - unassignedStudents.length,
        unassignedStudents: unassignedStudents.length,
      },
      unassignedStudents: unassignedStudents.map((s) => ({
        id: s.studentId,
        fullName: s.fullName,
        email: s.email,
        timeIn: s.timeIn,
        hasPC: false,
      })),
    });
  } catch (error) {
    console.error("Error fetching seating chart:", error);
    res.status(500).json({ error: "Failed to fetch seating chart" });
  }
}
