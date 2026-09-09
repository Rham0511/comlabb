import { Op } from "sequelize";
import QRCode from "qrcode";
import { logAuditEntry } from "./auditController.js";
import { getUserCampusFromSession, canManageRecord } from "./campusAuthController.js";
import { Attendance } from "../models/attendanceModel.js";
import { AttendanceSession } from "../models/attendanceSessionModel.js";
import { LaboratorySchedule } from "../models/laboratoryScheduleModel.js";
import { ClassListEntry } from "../models/classListEntryModel.js";
import { User } from "../models/userModel.js";

const getConfiguredBaseUrl = (req = null) => {
  const configuredBaseUrl = process.env.BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (req) {
    const forwardedProto = req.headers?.["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || req.protocol || "http";
    const host = req.get?.("host") || req.headers?.host || "localhost:3000";
    return `${protocol}://${host}`.replace(/\/+$/, "");
  }

  console.warn("[attendance] BASE_URL is not configured. Falling back to the current request host so QR codes can still be generated.");
  return "http://localhost:3000";
};

const buildScanUrl = (token, req = null) => {
  const baseUrl = getConfiguredBaseUrl(req);
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/attendance/scan/${encodeURIComponent(token)}`;
};

const sendJsonError = (res, status, message, error) => {
  console.error(message, error);
  return res.status(status).json({
    success: false,
    error: message,
    details: error?.message || null
  });
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const formatDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatTimeLabel = (value) => {
  if (!value) return "—";
  return value;
};

const getAttendanceRecordIdentity = (record) => {
  if (record?.id) return `id:${String(record.id).trim().toLowerCase()}`;

  const studentId = record?.studentId || record?.student_number || record?.studentNumber || "";
  const sessionToken = record?.sessionToken || record?.token || "";
  const dateValue = record?.date || record?.createdAt || record?.updatedAt || "";
  const subjectValue = record?.subject || "";
  const labValue = record?.lab || "";

  if (studentId || sessionToken) {
    return [
      "session",
      String(studentId).trim().toLowerCase(),
      String(sessionToken).trim().toLowerCase(),
      String(dateValue).trim().toLowerCase(),
      String(subjectValue).trim().toLowerCase(),
      String(labValue).trim().toLowerCase()
    ].join("|");
  }

  return [
    String(dateValue).trim().toLowerCase(),
    String(record?.timeIn || record?.time || "").trim().toLowerCase(),
    String(subjectValue).trim().toLowerCase(),
    String(labValue).trim().toLowerCase()
  ].join("|");
};

const deduplicateAttendanceRecords = (records = []) => {
  const uniqueRecords = [];
  const seen = new Set();

  (Array.isArray(records) ? records : []).forEach((record) => {
    const identity = getAttendanceRecordIdentity(record);
    if (!seen.has(identity)) {
      seen.add(identity);
      uniqueRecords.push(record);
    }
  });

  return uniqueRecords.sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
};

const parseAttendanceScanTime = (value, referenceDate = new Date()) => {
  if (!value || String(value).trim() === "" || String(value).trim().toLowerCase() === "not recorded") {
    return null;
  }

  const text = String(value).trim();
  const directDate = new Date(text);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const clockMatch = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(AM|PM)$/i);
  if (clockMatch) {
    let hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2] || 0);
    const seconds = Number(clockMatch[3] || 0);
    const meridiem = clockMatch[4].toUpperCase();

    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;

    const parsedDate = new Date(referenceDate);
    parsedDate.setHours(hours, minutes, seconds, 0);
    return parsedDate;
  }

  return null;
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

  let endTime = new Date(rawEndTime);
  if (endTime.getTime() <= startTime.getTime()) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60000);
  }

  const presentUntil = new Date(startTime.getTime() + 15 * 60000);
  const lateUntil = new Date(startTime.getTime() + 30 * 60000);
  return { startTime, endTime, presentUntil, lateUntil };
};

const getAttendanceStatusForSchedule = (schedule, now = new Date(), referenceDate = now) => {
  const window = getScheduleAttendanceWindow(schedule, referenceDate);
  if (!window) return "Present";

  const scanTime = now;
  const { startTime, presentUntil, lateUntil, endTime } = window;

  console.log("[attendance-status] Start Time:", startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
  console.log("[attendance-status] Present Until:", presentUntil.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
  console.log("[attendance-status] Late Until:", lateUntil.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
  console.log("[attendance-status] End Time:", endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
  console.log("[attendance-status] Scan Time:", scanTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));

  if (scanTime < startTime) {
    return "Not Yet Open";
  }

  if (scanTime <= presentUntil) {
    return "Present";
  }

  // Any check-in after the present window but before the end time is Late
  if (scanTime < endTime) {
    return "Late";
  }

  return "Closed";
};

const getAttendanceStatusForSession = async (session, now = new Date()) => {
  if (!session?.laboratoryScheduleId) return null;

  const schedule = await LaboratorySchedule.findByPk(session.laboratoryScheduleId);
  if (!schedule) return null;

  const referenceDate = session?.createdAt ? new Date(session.createdAt) : now;
  return getAttendanceStatusForSchedule(schedule, now, referenceDate);
};

export const deriveAttendanceStatusFromRecord = (record, schedule, session = null, now = new Date()) => {
  if (!schedule) {
    return record?.status || "Absent";
  }

  const referenceDate = session?.createdAt ? new Date(session.createdAt) : (record?.date ? new Date(`${record.date}T00:00:00`) : now);
  const window = getScheduleAttendanceWindow(schedule, referenceDate);
  if (!window) {
    return record?.status || "Absent";
  }

  if (!record?.timeIn || String(record.timeIn).trim().toLowerCase() === "not recorded") {
    return "Absent";
  }

  const scanTime = parseAttendanceScanTime(record.timeIn, referenceDate);
  if (!scanTime) {
    return record?.status || "Absent";
  }

  if (scanTime <= window.presentUntil) {
    return "Present";
  }

  // Any check-in after the present window but before the end time is Late
  if (scanTime < window.endTime) {
    return "Late";
  }

  return "Absent";
};

const getSessionCompletionStatus = (session, schedule, now = new Date()) => {
  if (!schedule) return "Completed";

  const window = getScheduleAttendanceWindow(schedule, session?.createdAt || now);
  if (!window) return "Completed";
  return now >= window.lateUntil ? "Completed" : "Active";
};

const finalizeAttendanceForSchedule = async (session, now = new Date()) => {
  if (!session?.laboratoryScheduleId || !session?.token) return null;

  const schedule = await LaboratorySchedule.findByPk(session.laboratoryScheduleId);
  if (!schedule) return null;

  const window = getScheduleAttendanceWindow(schedule, now);
  if (!window || now <= window.endTime) return null;

  const records = await Attendance.findAll({
    where: {
      laboratoryScheduleId: session.laboratoryScheduleId,
      sessionToken: session.token,
      status: "Absent"
    }
  });

  if (!records.length) return null;

  await Promise.all(records.map((record) => Attendance.update({ status: "Absent" }, { where: { id: record.id } })));
  return records.length;
};

const renderAttendancePageHtml = ({
  title,
  heading,
  message,
  detailRows,
  statusLabel,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  success = true,
  formAction = null,
  formInputs = {},
  successVariant = false,
  highlightMessage = null
}) => {
  const detailsHtml = detailRows.map(([label, value]) => `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <strong class="detail-value">${escapeHtml(value)}</strong>
    </div>
  `).join("");

  const highlightMarkup = highlightMessage
    ? `<div class="highlight-message">${escapeHtml(highlightMessage)}</div>`
    : "";

  const formMarkup = formAction
    ? `
      <form method="POST" action="${escapeHtml(formAction)}" class="actions">
        ${Object.entries(formInputs).map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`).join("")}
        <button type="submit" class="primary-btn">${escapeHtml(primaryLabel)}</button>
      </form>
    `
    : `
      <div class="actions">
        <a href="${escapeHtml(primaryHref)}" class="primary-btn">${escapeHtml(primaryLabel)}</a>
        <a href="${escapeHtml(secondaryHref)}" class="secondary-btn">${escapeHtml(secondaryLabel)}</a>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top left, rgba(16, 185, 129, 0.16), transparent 35%), linear-gradient(135deg, #07120c 0%, #0d1712 55%, #08110c 100%);
      color: #f2f8f4;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 1rem;
    }
    .card {
      width: min(100%, 700px);
      border-radius: 1.5rem;
      border: 2px solid rgba(6, 78, 59, 0.6);
      background: linear-gradient(145deg, rgba(8, 19, 14, 0.98), rgba(4, 10, 8, 0.96));
      box-shadow: 0 28px 70px rgba(2, 8, 23, 0.46);
      padding: 1.45rem;
      animation: fadeIn 0.35s ease;
      backdrop-filter: blur(16px);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.6rem 0.95rem;
      border-radius: 999px;
      font-weight: 700;
      background: rgba(2, 44, 34, 0.82);
      border: 1px solid rgba(52, 211, 153, 0.36);
      color: #6ee7b7;
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }
    .success-hero {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem 1rem 1.05rem;
      border-radius: 1rem;
      background: rgba(5, 20, 15, 0.72);
      border: 1px solid rgba(16, 185, 129, 0.2);
      margin-bottom: 1rem;
    }
    .success-hero .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.2);
      color: #a7f3d0;
      font-size: 1.15rem;
      border: 1px solid rgba(52, 211, 153, 0.26);
      flex-shrink: 0;
    }
    .highlight-message {
      margin-top: 0.75rem;
      padding: 0.9rem 0.95rem;
      border-radius: 0.95rem;
      background: rgba(4, 20, 15, 0.72);
      color: #bbf7d0;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2rem); color: #ecfdf5; font-weight: 700; }
    p { color: rgba(187, 247, 208, 0.84); line-height: 1.6; margin: 0.35rem 0 0; }
    .detail-list { margin: 1rem 0 1.25rem; display: grid; gap: 0.7rem; }
    .detail-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1rem;
      border-radius: 0.95rem;
      background: rgba(6, 14, 10, 0.78);
      border: 1px solid rgba(16, 185, 129, 0.24);
      color: #cbd5e1;
    }
    .detail-label { color: #6ee7b7; font-weight: 700; }
    .detail-value { color: #f5f7f2; text-align: right; font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.05rem; }
    .primary-btn, .secondary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem 1.1rem;
      border-radius: 0.95rem;
      font-weight: 700;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
    .primary-btn {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      box-shadow: 0 10px 24px rgba(5, 150, 105, 0.28);
    }
    .secondary-btn {
      background: rgba(6, 14, 10, 0.8);
      color: #e2e8f0;
      border: 1px solid rgba(16, 185, 129, 0.24);
    }
    @media (max-width: 640px) {
      .detail-row { flex-direction: column; align-items: flex-start; }
      .detail-value { text-align: left; }
      .actions { flex-direction: column; }
      .primary-btn, .secondary-btn { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-pill">${escapeHtml(statusLabel)}</div>
    ${successVariant ? `<div class="success-hero"><div class="icon">✓</div><div><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(message)}</p></div></div>` : `<h1>${escapeHtml(heading)}</h1><p>${escapeHtml(message)}</p>`}
    ${highlightMarkup}
    <div class="detail-list">${detailsHtml}</div>
    ${formMarkup}
  </div>
</body>
</html>`;
};

export const createAttendanceSession = async (req, res) => {
  try {
    const {
      scheduleId,
      sessionId,
      laboratoryScheduleId,
      schedule_id,
      title,
      day,
      time,
      room,
      status = "Confirmed",
      expirationMinutes,
      expiresInMinutes = 15
    } = req.body;

    const resolvedScheduleId = scheduleId ?? sessionId ?? laboratoryScheduleId ?? schedule_id;
    const normalizedExpirationMinutes = Number(expirationMinutes ?? expiresInMinutes ?? 15);
    const now = new Date();

    let resolvedTitle = title;
    let resolvedDay = day;
    let resolvedTime = time;
    let resolvedRoom = room;
    let resolvedStatus = status;

    if (resolvedScheduleId) {
      const schedule = await LaboratorySchedule.findByPk(resolvedScheduleId);
      if (!schedule) {
        return res.status(404).json({ error: `Selected schedule ${resolvedScheduleId} was not found.` });
      }

      // Campus-based authorization check
      const userCampus = await getUserCampusFromSession(req);
      if (!userCampus) {
        return res.status(403).json({ error: "Unauthorized: User campus not found." });
      }
      if (!canManageRecord(userCampus, schedule.campus)) {
        return res.status(403).json({ error: "You do not have permission to create attendance sessions for another campus." });
      }

      resolvedTitle = schedule.subject || resolvedTitle;
      resolvedDay = schedule.dayOfWeek || resolvedDay;
      resolvedTime = [schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || resolvedTime;
      resolvedRoom = schedule.laboratoryRoom || resolvedRoom;
      resolvedStatus = schedule.status || resolvedStatus;
    }

    if (!resolvedTitle || !resolvedTime || !resolvedRoom) {
      return res.status(400).json({ error: "Title, time, and room are required to create a session." });
    }

    const token = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + normalizedExpirationMinutes * 60000);
    const scheduleWindow = resolvedScheduleId ? getScheduleAttendanceWindow(await LaboratorySchedule.findByPk(resolvedScheduleId), now) : null;

    const session = await AttendanceSession.create({
      token,
      title: resolvedTitle,
      day: resolvedDay,
      time: resolvedTime,
      room: resolvedRoom,
      status: resolvedStatus,
      courseSection: req.body.courseSection || null,
      laboratoryScheduleId: resolvedScheduleId || null,
      expiresAt
    });

    if (resolvedScheduleId) {
      const classListEntries = await ClassListEntry.findAll({
        where: { laboratoryScheduleId: resolvedScheduleId }
      });

      if (classListEntries.length) {
        const today = new Date().toISOString().slice(0, 10);
        const placeholders = classListEntries.map((entry) => ({
          studentId: entry.studentId,
          fullName: entry.fullName,
          courseSection: entry.courseSection || "",
          subject: session.title,
          lab: session.room,
          instructor: resolvedStatus === "Confirmed" ? "Instructor" : "Instructor",
          date: today,
          timeIn: "Not recorded",
          status: "Absent",
          sessionToken: session.token,
          laboratoryScheduleId: resolvedScheduleId
        }));

        await Attendance.bulkCreate(placeholders, { ignoreDuplicates: true });
      }
    }

    await finalizeAttendanceForSchedule(session, now);

    await logAuditEntry(req, {
      action: "Attendance Session Created",
      module: "Attendance Monitoring",
      resourceId: session.id,
      description: `Created attendance session ${session.token} for schedule ${resolvedScheduleId || 'manual'}`,
      details: {
        token: session.token,
        scheduleId: resolvedScheduleId,
        expiresAt: session.expiresAt,
        status: session.status
      }
    });

    const attendanceUrl = buildScanUrl(session.token, req);
    console.log("Attendance URL:", attendanceUrl);
    const qrImage = attendanceUrl
      ? await QRCode.toDataURL(attendanceUrl, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "H"
        })
      : "";
    console.log(qrImage);

    return res.json({
      success: true,
      session: {
        token: session.token,
        title: session.title,
        day: session.day,
        time: session.time,
        room: session.room,
        status: session.status,
        expiresAt: session.expiresAt,
        scanUrl: attendanceUrl,
        qrCode: qrImage,
        qrImage
      }
    });
  } catch (error) {
    console.error("Attendance session creation failed.");
    console.error(error?.stack || error);
    return sendJsonError(res, 500, error?.message || "Unable to create attendance session.", error);
  }
};

const isInstructorRole = (role) => {
  const normalizedRole = (role || "").toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "technician" || normalizedRole === "instructor";
};

const isAdminRole = (role) => {
  return String(role || "").toLowerCase() === "admin";
};

const buildAttendanceCampusWhere = (campus) => {
  const canonicalCampus = String(campus || "").trim().replace(/\s*Campus\s*$/i, "").trim();
  return {
    [Op.or]: [
      { campus: canonicalCampus },
      { campus: `${canonicalCampus} Campus` }
    ]
  };
};

const getInstructorScheduleScope = async (req) => {
  if (!req.session?.userId) return null;

  const user = await User.findByPk(req.session.userId);
  if (!user) return null;

  if (user.role === "student") {
    return {
      kind: "student",
      studentId: user.student_number || user.studentId || user.student_id || String(user.id)
    };
  }

  if (isAdminRole(user.role)) {
    if (!user.campus || !String(user.campus).trim()) {
      return { kind: "instructor", user, schedules: [], scheduleIds: [], sessionTokens: [] };
    }
    // Admins: by default, treat as owning only schedules they created and also include unowned schedules
    // Filter by campus
    const campusFilter = buildAttendanceCampusWhere(user.campus);
    
    const ownedSchedules = await LaboratorySchedule.findAll({
      where: {
        ...campusFilter,
        [Op.or]: [
          { createdBy: user.id },
          { createdBy: null }
        ]
      },
      attributes: ["id", "subject", "dayOfWeek", "startTime", "endTime", "laboratoryRoom"]
    });

    const ownedScheduleIds = ownedSchedules.map((schedule) => schedule.id);
    const ownedSessions = await AttendanceSession.findAll({
      where: {
        laboratoryScheduleId: { [Op.in]: ownedScheduleIds }
      },
      attributes: ["token"]
    });

    const ownedSessionTokens = ownedSessions.map((session) => session.token).filter(Boolean);

    return {
      kind: "instructor",
      user,
      schedules: ownedSchedules,
      scheduleIds: ownedScheduleIds,
      sessionTokens: ownedSessionTokens
    };
  }

  if (!isInstructorRole(user.role)) {
    return { kind: "other" };
  }

  // For instructors/technicians: use createdBy ownership rather than string matching
  // Filter by campus
  if (!user.campus || !String(user.campus).trim()) {
    return { kind: "instructor", user, schedules: [], scheduleIds: [], sessionTokens: [] };
  }
  const campusFilter = buildAttendanceCampusWhere(user.campus);
  
  const schedules = await LaboratorySchedule.findAll({
    where: {
      createdBy: user.id,
      ...campusFilter
    },
    attributes: ["id"]
  });

  const scheduleIds = schedules.map((schedule) => schedule.id);
  return {
    kind: "instructor",
    user,
    schedules,
    scheduleIds,
    sessionTokens: []
  };
};

const getInstructorSessionStatus = (session, records, now = new Date()) => {
  const recordCount = records.length;
  const expired = session?.expiresAt ? new Date(session.expiresAt).getTime() <= now.getTime() : false;

  if (recordCount === 0 && !expired) {
    return "Active";
  }

  if (recordCount === 0) {
    return "No Records";
  }

  return expired ? "Completed" : "Active";
};

const getInstructorCourseSection = (session, records) => {
  if (session?.courseSection) return session.courseSection;
  const firstRecord = records[0];
  return firstRecord?.courseSection || "—";
};

const splitCourseSection = (courseSection) => {
  const parts = String(courseSection || "")
    .split(/\s*•\s*|\s+\|\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { course: "—", section: "—" };
  }

  if (parts.length === 1) {
    return { course: parts[0], section: "—" };
  }

  return {
    course: parts[0],
    section: parts.slice(1).join(" • ")
  };
};

const getInstructorDateRange = (range, sessions) => {
  const normalized = String(range || "all").toLowerCase();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return sessions.filter((session) => {
    const sessionDate = new Date(session.createdAt || session.updatedAt || session.date || now);
    if (normalized === "today") return sessionDate >= startOfToday;
    if (normalized === "week") return sessionDate >= startOfWeek;
    if (normalized === "month") return sessionDate >= startOfMonth;
    return true;
  });
};

const getInstructorAttendanceContext = async (req) => {
  const scope = await getInstructorScheduleScope(req);
  if (!scope || scope.kind !== "instructor") {
    return { scope: null, sessions: [], records: [], schedules: [] };
  }

  const now = new Date();
  const scheduleIds = scope.scheduleIds || [];
  const scheduleLookup = new Map((scope.schedules || []).map((schedule) => [String(schedule.id), schedule]));
  // Ensure there is at least one AttendanceSession record per schedule.
  // Batch existing sessions lookup and create any missing sessions in bulk
  // to avoid performing a separate DB query per schedule (which is slow).
  const scheduleList = (scope.schedules || []).filter(s => s && s.id);
  if (scheduleList.length) {
    const scheduleIds = scheduleList.map(s => s.id);
    const existingSessions = await AttendanceSession.findAll({
      where: { laboratoryScheduleId: { [Op.in]: scheduleIds } },
      attributes: ['laboratoryScheduleId']
    });
    const existingMap = new Set(existingSessions.map(s => String(s.laboratoryScheduleId)));
    const toCreate = scheduleList.filter(s => !existingMap.has(String(s.id))).map((schedule) => ({
      token: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: schedule.subject || "Attendance Session",
      day: schedule.dayOfWeek || null,
      time: [schedule.startTime, schedule.endTime].filter(Boolean).join(" - "),
      room: schedule.laboratoryRoom || null,
      courseSection: null,
      status: schedule.status || "Confirmed",
      laboratoryScheduleId: schedule.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }));

    if (toCreate.length) {
      try {
        await AttendanceSession.bulkCreate(toCreate, { ignoreDuplicates: true });
      } catch (err) {
        // Fallback: if bulkCreate fails for any reason, attempt individual creates
        for (const s of toCreate) {
          try { await AttendanceSession.create(s); } catch (e) { /* ignore */ }
        }
      }
    }
  }
  const fallbackSessionConditions = (scope.schedules || [])
    .map((schedule) => ({
      [Op.and]: [
        { title: schedule.subject },
        { day: schedule.dayOfWeek },
        { time: `${schedule.startTime} - ${schedule.endTime}` },
        { room: schedule.laboratoryRoom }
      ]
    }));

  const sessionWhere = scheduleIds.length || fallbackSessionConditions.length || (scope.sessionTokens?.length)
    ? {
        [Op.or]: [
          ...(scheduleIds.length ? [{ laboratoryScheduleId: { [Op.in]: scheduleIds } }] : []),
          ...fallbackSessionConditions,
          ...(scope.sessionTokens?.length ? [{ token: { [Op.in]: scope.sessionTokens } }] : [])
        ]
      }
    : null;

  const sessions = sessionWhere
    ? await AttendanceSession.findAll({
        where: sessionWhere,
        order: [["createdAt", "DESC"]]
      })
    : [];

  const sessionTokens = sessions.map((session) => session.token).filter(Boolean);
  const recordWhere = sessionTokens.length || scheduleIds.length
    ? {
        [Op.or]: [
          ...(scheduleIds.length ? [{ laboratoryScheduleId: { [Op.in]: scheduleIds } }] : []),
          ...(sessionTokens.length ? [{ sessionToken: { [Op.in]: sessionTokens } }] : [])
        ]
      }
    : null;

  const records = recordWhere
    ? await Attendance.findAll({
        where: recordWhere,
        order: [["createdAt", "ASC"]]
      })
    : [];

  // Trigger finalization of attendance for sessions but do not await each
  // finalization operation — this prevents expensive DB writes from blocking
  // the dashboard API response and improves perceived load time.
  for (const session of sessions) {
    // fire-and-forget; log errors but don't block
    finalizeAttendanceForSchedule(session, now).catch((err) => {
      console.warn('finalizeAttendanceForSchedule failed (non-blocking):', err?.message || err);
    });
  }

  const recordsByToken = records.reduce((accumulator, record) => {
    const key = record.sessionToken || String(record.laboratoryScheduleId || "");
    if (!key) return accumulator;
    if (!accumulator.has(key)) accumulator.set(key, []);
    accumulator.get(key).push(record);
    return accumulator;
  }, new Map());

  const sessionsWithRecords = sessions.map((session) => {
    const matchedRecords = recordsByToken.get(session.token) || recordsByToken.get(String(session.laboratoryScheduleId || "")) || [];
    const schedule = session.laboratoryScheduleId ? scheduleLookup.get(String(session.laboratoryScheduleId)) : null;
    const courseSection = getInstructorCourseSection(session, matchedRecords);
    const sectionDetails = splitCourseSection(courseSection);
    const presentCount = matchedRecords.filter((record) => deriveAttendanceStatusFromRecord(record, schedule, session, now) === "Present").length;
    const lateCount = matchedRecords.filter((record) => deriveAttendanceStatusFromRecord(record, schedule, session, now) === "Late").length;
    const absentCount = matchedRecords.filter((record) => deriveAttendanceStatusFromRecord(record, schedule, session, now) === "Absent").length;
    const subject = session.title || schedule?.subject || matchedRecords[0]?.subject || "—";
    const laboratory = session.room || schedule?.laboratoryRoom || matchedRecords[0]?.lab || "—";
    const time = session.time || [schedule?.startTime, schedule?.endTime].filter(Boolean).join(" - ") || "—";
    const sessionDate = session.createdAt || matchedRecords[0]?.date || now;
    const status = getSessionCompletionStatus(session, schedule, now);

    return {
      id: session.id,
      token: session.token,
      date: sessionDate,
      subject,
      section: sectionDetails.section,
      course: sectionDetails.course,
      laboratory,
      instructor: session.instructor || schedule?.instructor || matchedRecords[0]?.instructor || "Instructor",
      startTime: schedule?.startTime || null,
      endTime: schedule?.endTime || null,
      time,
      studentsPresent: presentCount,
      studentsLate: lateCount,
      studentsAbsent: absentCount,
      attendanceStatus: status,
      createdAt: session.createdAt,
      scheduleId: session.laboratoryScheduleId || null,
      totalStudents: matchedRecords.length,
      records: matchedRecords
    };
  });

  return {
    scope,
    schedules: scope.schedules || [],
    sessions: sessionsWithRecords,
    records,
    now
  };
};

export const getInstructorAttendanceDashboard = async (req, res) => {
  try {
    const { searchSubject = "", searchSection = "", dateRange = "all", status = "all" } = req.query;
    const context = await getInstructorAttendanceContext(req);

    if (!context.scope) {
      return res.status(403).json({ error: "Instructor access required." });
    }

    const now = context.now || new Date();
    const todayLabel = now.toISOString().slice(0, 10);
    const todayRecords = context.records.filter((record) => String(record.date) === todayLabel);
    const completedSessions = (context.sessions || []).filter((session) => String(session.attendanceStatus || "").toLowerCase() === "completed");
    const summary = {
      totalSessions: completedSessions.length,
      attendanceSessionsConducted: completedSessions.length,
      studentsPresentToday: completedSessions.reduce((total, session) => total + (session.studentsPresent || 0), 0),
      lateToday: completedSessions.reduce((total, session) => total + (session.studentsLate || 0), 0),
      absentToday: completedSessions.reduce((total, session) => total + (session.studentsAbsent || 0), 0)
    };

    const filteredSessions = getInstructorDateRange(dateRange, completedSessions)
      .filter((session) => {
        const matchesSubject = !searchSubject || String(session.subject || "").toLowerCase().includes(String(searchSubject).toLowerCase());
        const matchesSection = !searchSection || String(session.section || "").toLowerCase().includes(String(searchSection).toLowerCase());
        const matchesStatus = status === "all" || !status || String(session.attendanceStatus || "").toLowerCase() === String(status).toLowerCase();
        return matchesSubject && matchesSection && matchesStatus;
      })
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    const trendMap = new Map();
    const trendDates = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      trendDates.push(key);
      trendMap.set(key, 0);
    }
    context.records.forEach((record) => {
      const key = String(record.date || "");
      if (trendMap.has(key)) {
        trendMap.set(key, trendMap.get(key) + 1);
      }
    });

    const statusDistribution = filteredSessions.reduce((accumulator, session) => {
      const key = session.attendanceStatus || "No Records";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return res.json({
      success: true,
      summary,
      chart: {
        labels: trendDates.map((date) => new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })),
        trend: trendDates.map((date) => trendMap.get(date) || 0),
        statusLabels: Object.keys(statusDistribution),
        statusValues: Object.values(statusDistribution)
      },
      sessions: filteredSessions
    });
  } catch (error) {
    return sendJsonError(res, 500, "Unable to load instructor attendance dashboard.", error);
  }
};

export const getInstructorAttendanceSessionDetails = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const context = await getInstructorAttendanceContext(req);

    if (!context.scope) {
      return res.status(403).json({ error: "Instructor access required." });
    }

    const session = context.sessions.find((item) => String(item.id) === String(sessionId) || String(item.token) === String(sessionId));
    if (!session) {
      return res.status(404).json({ error: "Attendance session not found." });
    }

    const schedule = session.scheduleId ? await LaboratorySchedule.findByPk(session.scheduleId) : null;
    const records = session.records || [];
    const now = new Date();
    return res.json({
      success: true,
      session: {
        ...session,
        startTime: session.startTime || schedule?.startTime || null,
        endTime: session.endTime || schedule?.endTime || null,
        instructor: session.instructor || schedule?.instructor || "Instructor"
      },
      records: records.map((record) => ({
        id: record.id,
        studentId: record.studentId,
        studentName: record.fullName,
        course: splitCourseSection(record.courseSection).course,
        section: splitCourseSection(record.courseSection).section,
        timeIn: record.timeIn,
        attendanceStatus: deriveAttendanceStatusFromRecord(record, schedule, session, now),
        courseSection: record.courseSection
      }))
    });
  } catch (error) {
    return sendJsonError(res, 500, "Unable to load attendance session details.", error);
  }
};

export const getAttendanceRecords = async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const where = {};

    if (status && status !== "All") {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } },
        { lab: { [Op.like]: `%${search}%` } },
        { instructor: { [Op.like]: `%${search}%` } },
        { courseSection: { [Op.like]: `%${search}%` } }
      ];
    }

    const scope = await getInstructorScheduleScope(req);
    if (scope?.kind === "student") {
      where.studentId = scope.studentId;
      const userCampus = await getUserCampusFromSession(req);
      if (!userCampus) return res.json([]);
      const campusSchedules = await LaboratorySchedule.findAll({
        where: buildAttendanceCampusWhere(userCampus),
        attributes: ["id"]
      });
      where.laboratoryScheduleId = { [Op.in]: campusSchedules.map((schedule) => schedule.id) };
    } else if (scope?.kind === "instructor") {
      const orConditions = [];
      if (scope.scheduleIds?.length) orConditions.push({ laboratoryScheduleId: { [Op.in]: scope.scheduleIds } });
      if (scope.sessionTokens?.length) orConditions.push({ sessionToken: { [Op.in]: scope.sessionTokens } });
      if (orConditions.length) where[Op.or] = orConditions;
    }

    const records = await Attendance.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 200
    });

    const recordsWithDerivedStatus = await Promise.all(records.map(async (record) => {
      const schedule = record.laboratoryScheduleId ? await LaboratorySchedule.findByPk(record.laboratoryScheduleId) : null;
      const derivedStatus = schedule ? deriveAttendanceStatusFromRecord(record, schedule, null, new Date()) : record.status;
      return { ...record.toJSON(), status: derivedStatus };
    }));

    res.json(deduplicateAttendanceRecords(recordsWithDerivedStatus));
  } catch (error) {
    return sendJsonError(res, 500, "Unable to load attendance records.", error);
  }
};

export const getAttendanceStats = async (req, res) => {
  try {
    const scope = await getInstructorScheduleScope(req);

    if (scope?.kind === "student") {
      const studentId = scope.studentId;
      const userCampus = await getUserCampusFromSession(req);
      if (!userCampus) return res.status(403).json({ error: "Unauthorized: User campus not found." });
      const campusSchedules = await LaboratorySchedule.findAll({
        where: buildAttendanceCampusWhere(userCampus),
        attributes: ["id"]
      });
      const records = await Attendance.findAll({
        where: {
          studentId,
          laboratoryScheduleId: { [Op.in]: campusSchedules.map((schedule) => schedule.id) }
        },
        order: [["createdAt", "DESC"]],
        limit: 200
      });

      const recordsWithDerivedStatus = await Promise.all(records.map(async (record) => {
        const schedule = record.laboratoryScheduleId ? await LaboratorySchedule.findByPk(record.laboratoryScheduleId) : null;
        const derivedStatus = schedule ? deriveAttendanceStatusFromRecord(record, schedule, null, new Date()) : record.status;
        return { ...record.toJSON(), status: derivedStatus };
      }));

      const studentRecords = deduplicateAttendanceRecords(recordsWithDerivedStatus);
      const total = studentRecords.length;
      const present = studentRecords.filter((record) => String(record.status || "").toLowerCase() === "present").length;
      const late = studentRecords.filter((record) => String(record.status || "").toLowerCase() === "late").length;
      const absent = studentRecords.filter((record) => String(record.status || "").toLowerCase() === "absent").length;
      const percentage = total ? Math.round((present / Math.max(total, 1)) * 100) : 0;

      return res.json({ total, present, late, absent, percentage });
    }

    const context = await getInstructorAttendanceContext(req);
    const completedSessions = (context.sessions || []).filter((session) => String(session.attendanceStatus || "").toLowerCase() === "completed");
    const total = completedSessions.length;
    const present = completedSessions.reduce((sum, session) => sum + (session.studentsPresent || 0), 0);
    const late = completedSessions.reduce((sum, session) => sum + (session.studentsLate || 0), 0);
    const absent = completedSessions.reduce((sum, session) => sum + (session.studentsAbsent || 0), 0);
    const percentage = total ? Math.round((present / Math.max(total, 1)) * 100) : 0;

    return res.json({ total, present, late, absent, percentage });
  } catch (error) {
    return sendJsonError(res, 500, "Unable to load attendance stats.", error);
  }
};

const buildAttendanceRecordPayload = async (req, session, token) => {
  const student = req.session?.userId ? await User.findByPk(req.session.userId) : null;
  const studentId = student?.student_number || student?.studentId || student?.student_id || req.query.studentId || req.body.studentId || "—";
  const fullName = student?.name || req.query.fullName || req.body.fullName || "Student";
  const program = student?.program || student?.course || student?.programName || student?.department || "—";
  const yearLevel = student?.year || student?.yearLevel || student?.yearLevelName || "—";
  const section = student?.section || student?.sectionName || "—";
  const courseSection = req.query.courseSection || req.body.courseSection || [program, yearLevel, section].filter(Boolean).join(" • ") || "Student";
  const status = (req.query.status || req.body.status || "Present").trim();
  const dateString = new Date().toISOString().slice(0, 10);
  const timeString = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return {
    token,
    session,
    student,
    studentId,
    fullName,
    program,
    yearLevel,
    section,
    courseSection,
    status,
    dateString,
    timeString,
    subject: session?.title || req.query.subject || req.body.subject || "Attendance Session",
    lab: session?.room || req.query.lab || req.body.lab || "Laboratory",
    instructor: session?.status === "Confirmed" ? "Instructor" : "Instructor"
  };
};

const recordAttendance = async (req, res, token, session) => {
  const payload = await buildAttendanceRecordPayload(req, session, token);
  const now = new Date();
  let schedule = null;

  if (session?.laboratoryScheduleId) {
    schedule = await LaboratorySchedule.findByPk(session.laboratoryScheduleId);
  }

  if (schedule) {
    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus || !schedule.campus || !canManageRecord(userCampus, schedule.campus)) {
      return res.status(403).json({ success: false, error: "You do not have permission to record attendance for another campus." });
    }
  }

  const attendanceStatus = schedule ? await getAttendanceStatusForSession(session, now) : (payload.status === "Late" ? "Late" : payload.status === "Absent" ? "Absent" : "Present");

  if (attendanceStatus === "Not Yet Open") {
    const referenceDate = session?.createdAt ? new Date(session.createdAt) : now;
    const startTime = schedule ? parseScheduleClockTime(schedule.startTime, referenceDate) : null;
    const formattedStartTime = startTime ? startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : schedule?.startTime || "the scheduled start time";
    const notOpenMessage = `Attendance for this session will open at ${formattedStartTime}.`;
    const html = renderAttendancePageHtml({
      title: "Attendance Not Yet Open",
      heading: "Attendance Not Yet Open",
      message: notOpenMessage,
      detailRows: [["Status", "Attendance has not yet opened"]],
      statusLabel: "Not Yet Open",
      primaryLabel: "Back to Dashboard",
      primaryHref: "/student/dashboard",
      secondaryLabel: "Close",
      secondaryHref: "#",
      success: false
    });

    if (req.accepts("html")) return res.status(409).send(html);
    return res.status(409).json({ success: false, error: notOpenMessage });
  }

  if (attendanceStatus === "Closed") {
    const closedMessage = "Attendance for this schedule has already closed. No further scans are accepted.";
    const html = renderAttendancePageHtml({
      title: "Attendance Closed",
      heading: "Attendance Closed",
      message: closedMessage,
      detailRows: [["Status", "The attendance window has ended"]],
      statusLabel: "Closed",
      primaryLabel: "Back to Dashboard",
      primaryHref: "/student/dashboard",
      secondaryLabel: "Close",
      secondaryHref: "#",
      success: false
    });

    if (req.accepts("html")) return res.status(410).send(html);
    return res.status(410).json({ success: false, error: closedMessage });
  }

  const existing = await Attendance.findOne({
    where: {
      studentId: payload.studentId,
      sessionToken: token,
      date: payload.dateString
    }
  });

  if (existing) {
    if (existing.status === "Absent") {
      existing.status = attendanceStatus === "Late" ? "Late" : attendanceStatus === "Absent" ? "Absent" : "Present";
      existing.timeIn = payload.timeString;
      existing.courseSection = payload.courseSection;
      existing.fullName = payload.fullName;
      existing.lab = payload.lab;
      existing.instructor = payload.instructor;
      await existing.save();

        await logAuditEntry(req, {
          action: "Attendance Updated",
          module: "Attendance Monitoring",
          resourceId: existing.id,
          description: `Updated attendance for ${existing.fullName} (${existing.studentId}) in session ${token}.`,
          details: {
            studentId: existing.studentId,
            studentName: existing.fullName,
            sessionToken: token,
            status: existing.status,
            timeIn: existing.timeIn
          }
        });

      const html = renderAttendancePageHtml({
        title: "Attendance Updated",
        heading: "Attendance Updated Successfully",
        message: "Your attendance status has been updated for this session.",
        detailRows: details,
        statusLabel: "✓ Attendance Updated",
        primaryLabel: "View My Attendance History",
        primaryHref: "/student/dashboard#attendance",
        secondaryLabel: "Return to Student Dashboard",
        secondaryHref: "/student/dashboard",
        successVariant: true,
        highlightMessage: "Your attendance has been updated successfully."
      });

      if (req.accepts("html")) return res.send(html);
      return res.json({ success: true, message: "Attendance updated successfully.", attendance: existing });
    }

    const details = [
      ["Student Name", existing.fullName],
      ["Student Number", existing.studentId],
      ["Program", payload.program || "—"],
      ["Year & Section", [payload.yearLevel, payload.section].filter(Boolean).join(" • ") || "—"],
      ["Subject", existing.subject],
      ["Laboratory Room", existing.lab],
      ["Date", formatDateLabel(existing.date)],
      ["Time Recorded", formatTimeLabel(existing.timeIn)],
      ["Attendance Status", existing.status]
    ];

    const html = renderAttendancePageHtml({
      title: "Attendance Recorded",
      heading: "Attendance Recorded Successfully",
      message: "Your attendance has already been recorded for this session.",
      detailRows: details,
      statusLabel: "✓ Attendance Recorded",
      primaryLabel: "View My Attendance History",
      primaryHref: "/student/dashboard#attendance",
      secondaryLabel: "Return to Student Dashboard",
      secondaryHref: "/student/dashboard",
      successVariant: true,
      highlightMessage: "Your attendance has already been recorded for this session."
    });

    if (req.accepts("html")) return res.send(html);
    return res.json({ success: true, message: "Attendance was already recorded for this session.", attendance: existing });
  }

  const attendance = await Attendance.create({
    studentId: payload.studentId,
    fullName: payload.fullName,
    courseSection: payload.courseSection,
    subject: payload.subject,
    lab: payload.lab,
    instructor: payload.instructor,
    date: payload.dateString,
    timeIn: payload.timeString,
    status: attendanceStatus === "Late" ? "Late" : attendanceStatus === "Absent" ? "Absent" : "Present",
    sessionToken: token,
    laboratoryScheduleId: session?.laboratoryScheduleId || null
  });

  await logAuditEntry(req, {
    action: "Attendance Recorded",
    module: "Attendance Monitoring",
    resourceId: attendance.id,
    description: `Recorded attendance for ${attendance.fullName} (${attendance.studentId}) in session ${token}.`,
    details: {
      studentId: attendance.studentId,
      studentName: attendance.fullName,
      sessionToken: token,
      status: attendance.status,
      timeIn: attendance.timeIn
    }
  });

  if (session?.token && !session.courseSection && payload.courseSection) {
    await AttendanceSession.update({ courseSection: payload.courseSection }, { where: { token: session.token } });
  }

  const details = [
    ["Student Name", attendance.fullName],
    ["Student Number", attendance.studentId],
    ["Program", payload.program || "—"],
    ["Year & Section", [payload.yearLevel, payload.section].filter(Boolean).join(" • ") || "—"],
    ["Subject", attendance.subject],
    ["Laboratory Room", attendance.lab],
    ["Date", formatDateLabel(attendance.date)],
    ["Time Recorded", formatTimeLabel(attendance.timeIn)],
    ["Attendance Status", attendance.status]
  ];

  const html = renderAttendancePageHtml({
    title: "Attendance Recorded",
    heading: "Attendance Recorded Successfully",
    message: `Thank you, ${attendance.fullName}! Your attendance has been successfully recorded.`,
    detailRows: details,
    statusLabel: "✓ Attendance Recorded",
    primaryLabel: "View My Attendance History",
    primaryHref: "/student/dashboard#attendance",
    secondaryLabel: "Return to Student Dashboard",
    secondaryHref: "/student/dashboard",
    successVariant: true,
    highlightMessage: "Your attendance has been successfully recorded."
  });

  if (req.accepts("html")) return res.send(html);
  return res.json({ success: true, attendance, message: "Attendance recorded successfully." });
};

export const scanAttendance = async (req, res) => {
  try {
    const token = req.query.token || req.body.token || req.params.token || req.params.sessionId || req.params.sessionToken;
    if (!token) {
      return res.status(400).json({ error: "Attendance token is required." });
    }

    const session = await AttendanceSession.findOne({ where: { token } });
    if (!session) {
      const message = "Attendance session not found. Please scan a valid QR code.";
      if (req.accepts("html")) return res.status(404).send(renderAttendancePageHtml({
        title: "Invalid QR Code",
        heading: "Invalid QR Code",
        message,
        detailRows: [["Status", "Unable to continue"]],
        statusLabel: "Unable to record",
        primaryLabel: "Back to Dashboard",
        primaryHref: "/student/dashboard",
        secondaryLabel: "Close",
        secondaryHref: "#",
        success: false
      }));
      return res.status(404).json({ error: message });
    }

    if (session.expiresAt < new Date()) {
      const message = "This attendance QR code has expired. Generate a new one and scan again.";
      if (req.accepts("html")) return res.status(410).send(renderAttendancePageHtml({
        title: "QR Expired",
        heading: "QR Expired",
        message,
        detailRows: [["Status", "The session is no longer active"]],
        statusLabel: "Unable to record",
        primaryLabel: "Back to Dashboard",
        primaryHref: "/student/dashboard",
        secondaryLabel: "Close",
        secondaryHref: "#",
        success: false
      }));
      return res.status(410).json({ error: message });
    }

    if (req.method === "POST") {
      return recordAttendance(req, res, token, session);
    }

    if (!req.session?.userId) {
      req.session.redirectTo = `/attendance/scan/${encodeURIComponent(token)}`;
      return res.redirect("/login");
    }

    const user = await User.findByPk(req.session.userId);
    if (!user || (user.role || "").toLowerCase() !== "student") {
      req.session.redirectTo = `/attendance/scan/${encodeURIComponent(token)}`;
      return res.redirect("/login");
    }

    const schedule = session?.laboratoryScheduleId ? await LaboratorySchedule.findByPk(session.laboratoryScheduleId) : null;
    const userCampus = await getUserCampusFromSession(req);
    if (schedule && (!userCampus || !schedule.campus || !canManageRecord(userCampus, schedule.campus))) {
      return res.status(403).send("You do not have permission to access attendance for another campus.");
    }
    const attendanceStatus = schedule ? await getAttendanceStatusForSession(session, new Date()) : null;

    if (attendanceStatus === "Not Yet Open") {
      const referenceDate = session?.createdAt ? new Date(session.createdAt) : new Date();
      const startTime = schedule ? parseScheduleClockTime(schedule.startTime, referenceDate) : null;
      const formattedStartTime = startTime ? startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : schedule?.startTime || "the scheduled start time";
      const html = renderAttendancePageHtml({
        title: "Attendance Not Yet Open",
        heading: "Attendance Not Yet Open",
        message: `Attendance for this session will open at ${formattedStartTime}.`,
        detailRows: [["Status", "Attendance has not yet opened"]],
        statusLabel: "Not Yet Open",
        primaryLabel: "Back to Dashboard",
        primaryHref: "/student/dashboard",
        secondaryLabel: "Close",
        secondaryHref: "#",
        success: false
      });

      if (req.accepts("html")) return res.status(409).send(html);
      return res.status(409).json({ success: false, error: `Attendance for this session will open at ${formattedStartTime}.` });
    }

    if (attendanceStatus === "Closed") {
      const closedMessage = "Attendance for this schedule has already closed. No further scans are accepted.";
      const html = renderAttendancePageHtml({
        title: "Attendance Closed",
        heading: "Attendance Closed",
        message: closedMessage,
        detailRows: [["Status", "The attendance window has ended"]],
        statusLabel: "Closed",
        primaryLabel: "Back to Dashboard",
        primaryHref: "/student/dashboard",
        secondaryLabel: "Close",
        secondaryHref: "#",
        success: false
      });

      if (req.accepts("html")) return res.status(410).send(html);
      return res.status(410).json({ success: false, error: closedMessage });
    }

    const payload = await buildAttendanceRecordPayload(req, session, token);
    const detailRows = [
      ["Student Name", payload.fullName],
      ["Student Number", payload.studentId],
      ["Program", payload.program || "—"],
      ["Year", payload.yearLevel || "—"],
      ["Section", payload.section || "—"],
      ["Subject", payload.subject],
      ["Laboratory", payload.lab],
      ["Date", formatDateLabel(payload.dateString)],
      ["Current Time", formatTimeLabel(payload.timeString)],
      ["Attendance Status", "Ready to Check In"]
    ];

    const html = renderAttendancePageHtml({
      title: "Attendance Confirmation",
      heading: "Attendance Confirmation",
      message: "Review the session details below and confirm your attendance.",
      detailRows,
      statusLabel: "Ready to Check In",
      primaryLabel: "Confirm Attendance",
      primaryHref: "/api/attendance/scan",
      secondaryLabel: "Back",
      secondaryHref: "/student/dashboard",
      success: true,
      formAction: "/api/attendance/scan",
      formInputs: {
        token,
        studentId: payload.studentId,
        fullName: payload.fullName,
        subject: payload.subject,
        lab: payload.lab,
        courseSection: payload.courseSection,
        status: payload.status
      }
    });

    if (req.accepts("html")) return res.send(html);
    return res.json({ success: true, attendance: null, payload });
  } catch (error) {
    console.error("Failed to record attendance:", error);
    if (req.accepts("html")) return res.status(500).send(renderAttendancePageHtml({
      title: "Recording Failed",
      heading: "Recording Failed",
      message: "Unable to record attendance at this time.",
      detailRows: [["Status", "Try again in a moment"]],
      statusLabel: "Unable to record",
      primaryLabel: "Back to Dashboard",
      primaryHref: "/student/dashboard",
      secondaryLabel: "Close",
      secondaryHref: "#",
      success: false
    }));
    return res.status(500).json({ error: "Unable to record attendance.", details: error?.message || null });
  }
};
