/*
  MIT License
  
  Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
  Mindoro State University - Philippines

*/

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import multer from "multer";
import { User } from "../models/userModel.js";
import { Equipment } from "../models/equipmentModel.js";
import { BorrowRecord } from "../models/borrowRecordModel.js";
import { MaintenanceRequest } from "../models/maintenanceRequestModel.js";
import { loginPage, registerPage, loginUser, registerUser, dashboardPage, logoutUser, forgotPasswordPage, forgotPassword, verifyOtpPage, verifyOtp, resendOtp, resetPasswordPage, resetPassword, verifyEmail, updateProfile, uploadStudentPhoto } from "../controllers/authController.js";
import { homePage } from "../controllers/homeController.js";
import { inventoryPage, viewEquipmentPage, getEquipment, getEquipmentCampusTotals, createEquipment, updateEquipment, updateEquipmentStatus, deleteEquipment, getEquipmentQr, getEquipmentCategories, createEquipmentCategory, deleteEquipmentCategory } from "../controllers/equipmentController.js";
import { listBorrowRecords, createBorrowRecord, returnBorrowRecord, getBorrowHistory, approveBorrowRecord, rejectBorrowRecord, listBorrowNotifications, markBorrowNotificationRead, markBorrowRecordLost } from "../controllers/borrowController.js";
import { listEquipmentAvailability, getEquipmentBorrowingHistory } from "../controllers/equipmentAvailabilityController.js";
import { getAttendanceRecords, getAttendanceStats, getInstructorAttendanceDashboard, getInstructorAttendanceSessionDetails, scanAttendance, createAttendanceSession } from "../controllers/attendanceController.js";
import { getAuditLogs, logAuditEntry } from "../controllers/auditController.js";
import { getUserAuthContext, getUserCampusFromSession, canManageRecord, isAdminRole as isCampusAdminRole } from "../controllers/campusAuthController.js";
import { LaboratorySchedule } from "../models/laboratoryScheduleModel.js";
import { ClassListEntry } from "../models/classListEntryModel.js";
import { AttendanceSession } from "../models/attendanceSessionModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { sequelize } from "../models/db.js";
import { DataTypes, Op, QueryTypes } from "sequelize";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../public/uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

const router = express.Router();

const staticHtmlPages = [
  "admin-dashboard",
  "student-dashboard",
  "student-borrow-equipment",
  "student-profile",
  "student-my-requests",
  "student-report-issue",
  "technician-dashboard",
  "attendance",
  "maintenance-reports",
  "borrow-equipment"
];

const normalizeRoleName = (role) => String(role || "").trim().toLowerCase();
const isAdminRole = (role) => normalizeRoleName(role).includes("admin");
const getRequestRoleValue = (req) => req.session?.userRole || req.user?.role || "";
const canBypassAuditAccessForDev = (req) => {
  if (process.env.NODE_ENV === "production") return false;
  const rawBypass = String(req.query?.devBypass || "").toLowerCase();
  const devRole = normalizeRoleName(req.headers?.["x-dev-role"] || req.query?.devRole || req.query?.role);
  return devRole === "admin" || rawBypass === "true" || rawBypass === "1";
};
const requireAdminForAudit = async (req, res, next) => {
  if (canBypassAuditAccessForDev(req)) return next();
  if (!req.session?.userId) return res.status(403).send("Forbidden: admin only.");

  try {
    const sessionRole = normalizeRoleName(getRequestRoleValue(req));
    if (isAdminRole(sessionRole)) return next();

    const user = await User.findByPk(req.session.userId, { attributes: ["role"] });
    if (isAdminRole(user?.role)) return next();
  } catch (error) {
    console.warn("[AuditAuth] Failed to resolve admin role from session", error?.message || error);
  }

  res.status(403).send("Forbidden: admin only.");
};

const pageConfigs = {
  "attendance-monitoring": {
    title: "Attendance Monitoring",
    description: "",
    backRoute: "/admin-dashboard",
    backLabel: "Back to Admin Dashboard",
    content: `
      <style>
        :root {
          --bg: #07150F;
          --bg-secondary: #0A1D15;
          --panel: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          --panel-strong: linear-gradient(180deg, rgba(15,36,27,.98), rgba(10,29,21,.98));
          --panel-soft: rgba(74,222,128,.06);
          --border: rgba(74,222,128,.15);
          --text: #F8FAFC;
          --muted: #B6D7C8;
          --accent: #22C55E;
          --accent-strong: #16A34A;
          --accent-soft: rgba(74,222,128,.12);
          --shadow: 0 12px 35px rgba(6,64,43,.18);
          --shadow-hover: 0 18px 40px rgba(34,197,94,.18);
        }

        .attendance-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.35rem 1.35rem 1.4rem;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          box-shadow: var(--shadow);
          backdrop-filter: blur(16px) saturate(1.04);
          margin-bottom: 1.5rem;
        }

        .attendance-page-title {
          font-size: 2rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .attendance-page-card {
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 20px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(14px) saturate(1.04);
          overflow: hidden;
          padding: 1.25rem 1.3rem 1.35rem;
        }

        .attendance-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          margin-bottom: 1.2rem;
        }

        .attendance-summary-card {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 1rem 1.05rem 1rem;
          background: var(--panel);
          box-shadow: var(--shadow);
          min-height: 122px;
          backdrop-filter: blur(14px) saturate(1.04);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .attendance-summary-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-hover);
        }

        .attendance-summary-icon {
          position: absolute;
          top: 0.8rem;
          right: 0.8rem;
          color: #bbf7d0;
          font-size: 1.7rem;
          opacity: 0.95;
          background: rgba(74,222,128,.12);
          border: 1px solid rgba(74,222,128,.16);
          border-radius: 0.85rem;
          width: 2.6rem;
          height: 2.6rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .attendance-summary-label {
          color: #bbf7d0;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-weight: 700;
        }

        .attendance-summary-value {
          font-size: 2.15rem;
          font-weight: 800;
          margin-top: 0.5rem;
          color: #f8fafc;
          line-height: 1.15;
        }

        .attendance-filter-row {
          display: grid;
          grid-template-columns: 2.1fr 1fr 1.15fr 1fr;
          gap: 0.9rem;
          margin-top: 0.25rem;
          margin-bottom: 1.1rem;
          padding-top: 1.15rem;
          align-items: start;
        }

        .attendance-filter-field {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .attendance-filter-label {
          font-size: 0.96rem;
          font-weight: 700;
          color: #cbd5e1;
          letter-spacing: 0.02em;
        }

        .attendance-filter-input,
        .attendance-filter-select {
          width: 100%;
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          color: var(--text);
          border: 1px solid rgba(74,222,128,.16);
          border-radius: 0.75rem;
          padding: 0.9rem 1.2rem;
          outline: none;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .attendance-filter-input:focus,
        .attendance-filter-select:focus {
          border-color: rgba(110,231,183,.62);
          box-shadow: 0 0 0 3px rgba(34,197,94,.1);
        }

        .attendance-table-wrap {
          overflow-x: auto;
          overflow-y: hidden;
          max-height: 24rem;
          border-radius: 16px;
          border: 1px solid rgba(74,222,128,.12);
          background: rgba(74,222,128,.04);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
          margin-bottom: 1.1rem;
        }

        .attendance-table {
          width: 100%;
          border-collapse: collapse;
        }

        .attendance-table th {
          text-align: left;
          padding: 0.95rem 0.9rem;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-weight: 700;
          color: #D1FAE5;
          background: linear-gradient(180deg, rgba(18,49,36,.95), rgba(20,59,42,.95));
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          white-space: nowrap;
        }

        .attendance-table td {
          text-align: left;
          padding: 0.95rem 0.9rem;
          font-size: 0.95rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          white-space: nowrap;
          line-height: 1.5;
          color: var(--text);
        }

        .attendance-table tbody tr {
          transition: background-color 0.2s ease;
        }

        .attendance-table tbody tr:hover {
          background: rgba(20,59,42,.45);
        }

        .attendance-action-btn {
          border: 1px solid rgba(74,222,128,.16);
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          color: var(--text);
          border-radius: 999px;
          padding: 0.6rem 0.9rem;
          font-size: 0.92rem;
          font-weight: 700;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
          cursor: pointer;
          white-space: nowrap;
        }

        .attendance-action-btn:hover {
          border-color: rgba(74,222,128,.24);
          transform: translateY(-1px);
          box-shadow: var(--shadow-hover);
        }

        .attendance-pagination-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 0.55rem;
          margin-top: 0.9rem;
        }

        .attendance-pagination-btn {
          min-width: 2.2rem;
          height: 2.2rem;
          border: 1px solid rgba(74,222,128,.16);
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          color: var(--text);
          border-radius: 999px;
          padding: 0 0.8rem;
          font-size: 0.9rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
          cursor: pointer;
        }

        .attendance-pagination-btn:hover:not(:disabled) {
          border-color: rgba(74,222,128,.24);
          transform: translateY(-1px);
          box-shadow: var(--shadow-hover);
        }

        .attendance-pagination-btn.active {
          border-color: rgba(74,222,128,.2);
          background: linear-gradient(135deg, rgba(16,185,129,1), rgba(52,211,153,1));
          color: #000;
          font-weight: 800;
          border-radius: 0.5rem;
          padding: 0.25rem 0.75rem;
          box-shadow: 0 10px 24px rgba(6,64,43,.16);
        }

        .attendance-pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .attendance-pagination-info {
          font-size: 0.95rem;
          color: #cbd5e1;
        }

        @media (max-width: 1024px) {
          .attendance-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .attendance-filter-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 720px) {
          .attendance-summary-grid,
          .attendance-filter-row {
            grid-template-columns: 1fr;
          }
          .attendance-table th,
          .attendance-table td {
            font-size: 0.9rem;
            padding: 0.8rem 0.7rem;
          }
        }
      </style>

      <div class="attendance-page-header">
        <h2 class="attendance-page-title">Completed Attendance Sessions</h2>
      </div>

      <div class="attendance-page-card">
        <div class="attendance-summary-grid">
          <div class="attendance-summary-card">
            <div class="attendance-summary-icon"><i class="fas fa-users"></i></div>
            <div class="attendance-summary-label">Total Sessions</div>
            <div class="attendance-summary-value" id="totalSessionsValue">0</div>
          </div>
          <div class="attendance-summary-card">
            <div class="attendance-summary-icon"><i class="fas fa-check-circle"></i></div>
            <div class="attendance-summary-label">Present Today</div>
            <div class="attendance-summary-value" id="presentTodayValue">0</div>
          </div>
          <div class="attendance-summary-card">
            <div class="attendance-summary-icon"><i class="fas fa-times-circle"></i></div>
            <div class="attendance-summary-label">Absent Today</div>
            <div class="attendance-summary-value" id="absentTodayValue">0</div>
          </div>
          <div class="attendance-summary-card">
            <div class="attendance-summary-icon"><i class="fas fa-clock"></i></div>
            <div class="attendance-summary-label">Late Today</div>
            <div class="attendance-summary-value" id="lateTodayValue">0</div>
          </div>
        </div>

        <div class="attendance-filter-row">
          <div class="attendance-filter-field">
            <label class="attendance-filter-label">Search</label>
            <input id="attendanceSearch" type="text" placeholder="Search by subject or instructor" class="attendance-filter-input" />
          </div>
          <div class="attendance-filter-field">
            <label class="attendance-filter-label">Campus</label>
            <select id="attendanceCampusFilter" class="attendance-filter-select">
              <option value="">All Campuses</option>
              <option value="Bongabong">Bongabong</option>
              <option value="Calapan">Calapan</option>
              <option value="Victoria">Victoria</option>
            </select>
          </div>
          <div class="attendance-filter-field">
            <label class="attendance-filter-label">Laboratory</label>
            <select id="attendanceLabFilter" class="attendance-filter-select">
              <option value="">All Laboratories</option>
              <option value="Laboratory 1 — Room 202">Lab 1 — Room 202</option>
              <option value="Laboratory 2 — Room 204">Lab 2 — Room 204</option>
            </select>
          </div>
          <div class="attendance-filter-field">
            <label class="attendance-filter-label">Date</label>
            <input id="attendanceDateFilter" type="date" class="attendance-filter-input" />
          </div>
        </div>

        <div class="attendance-table-wrap">
          <table class="attendance-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Laboratory</th>
                <th>Instructor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Counts</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="attendanceMonitorTableBody">
              <tr>
                <td colspan="7" class="text-center text-slate-400">Loading attendance sessions...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="attendance-pagination-row">
          <div class="attendance-pagination-info" id="attendancePaginationInfo">Showing 0 of 0</div>
          <div id="attendancePagination" class="flex flex-wrap items-center gap-2"></div>
        </div>
      </div>

      <style>
        body.modal-open { overflow: hidden; }

        #attendanceSessionModal .modal-content {
          width: min(100%, 58rem);
          max-width: 58rem;
          max-height: 88vh;
          min-height: 0;
          padding: 0;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(15,36,27,.98), rgba(8,24,17,.98));
          border: 2px solid rgba(74,222,128,.28);
          border-radius: 24px;
          box-shadow: 0 24px 70px rgba(6,64,43,.38), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(18px) saturate(1.08);
        }

        #attendanceSessionModal .attendance-modal-header {
          padding: 1.5rem 1.75rem 1.35rem;
          background: linear-gradient(180deg, rgba(18,48,34,.96), rgba(10,31,21,.92));
          border-bottom: 1px solid rgba(74,222,128,.2);
        }

        #attendanceSessionModal .attendance-modal-subtitle {
          color: rgba(167,243,208,.72);
          margin-top: .4rem;
        }

        #attendanceSessionModal .attendance-modal-close {
          color: rgba(167,243,208,.72);
          transition: color .2s ease, background .2s ease;
          border-radius: .75rem;
          padding: .35rem .5rem;
        }

        #attendanceSessionModal .attendance-modal-close:hover {
          color: #f0fdf4;
          background: rgba(74,222,128,.12);
        }

        #attendanceSessionModal .attendance-modal-body {
          min-height: 0;
          padding: 1.5rem 1.75rem 1.75rem;
          background: linear-gradient(180deg, rgba(8,24,17,.72), rgba(6,20,14,.88));
          overflow: hidden;
        }

        #attendanceSessionModal .attendance-modal-body > #attendanceSessionModalContent {
          min-width: 0;
        }

        #attendanceSessionModal .attendance-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 1.35rem;
        }

        #attendanceSessionModal .attendance-summary-card {
          min-height: 6.8rem;
          padding: 1rem 1.05rem;
          border-radius: 1rem;
          border: 1px solid rgba(74,222,128,.2);
          background: linear-gradient(180deg, rgba(18,48,34,.82), rgba(10,29,21,.9));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 10px 24px rgba(6,64,43,.14);
        }

        #attendanceSessionModal .attendance-summary-card .card-header {
          padding: 0;
          gap: .75rem;
        }

        #attendanceSessionModal .attendance-summary-card .card-title {
          color: rgba(216,243,224,.72);
          font-size: .75rem;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        #attendanceSessionModal .attendance-summary-card h2 {
          margin-top: .55rem;
          line-height: 1;
        }

        #attendanceSessionModal .attendance-summary-card .card-icon {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: .85rem;
          flex-shrink: 0;
        }

        #attendanceSessionModal .attendance-modal-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: .75rem;
          margin-bottom: 1.15rem;
        }

        #attendanceSessionModal .attendance-modal-controls input {
          min-width: min(100%, 18rem);
          flex: 1 1 18rem;
          border: 1px solid rgba(74,222,128,.2);
          border-radius: .85rem;
          background: rgba(12,30,22,.72);
          color: #ecfdf5;
          padding: .7rem .9rem;
          outline: none;
        }

        #attendanceSessionModal .attendance-modal-controls input:focus {
          border-color: rgba(110,231,183,.62);
          box-shadow: 0 0 0 3px rgba(34,197,94,.1);
        }

        #attendanceSessionModal .attendance-modal-controls button {
          border: 1px solid rgba(74,222,128,.22);
          border-radius: .85rem;
          background: rgba(34,197,94,.12);
          color: #d1fae5;
          padding: .7rem .95rem;
          font-weight: 600;
          transition: background .2s ease, border-color .2s ease;
        }

        #attendanceSessionModal .attendance-modal-controls button:hover {
          background: rgba(34,197,94,.2);
          border-color: rgba(110,231,183,.45);
        }

        #attendanceSessionModal .attendance-table-wrap {
          max-height: min(50vh, 28rem);
          overflow-x: auto;
          overflow-y: auto;
          border: 1px solid rgba(74,222,128,.16);
          border-radius: 1rem;
          background: rgba(8,20,14,.55);
        }

        #attendanceSessionModal .attendance-table-wrap table {
          width: 100%;
          min-width: 0;
          table-layout: auto;
          border-collapse: separate;
          border-spacing: 0;
        }

        #attendanceSessionModal .attendance-table-wrap th,
        #attendanceSessionModal .attendance-table-wrap td {
          vertical-align: top;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        #attendanceSessionModal .attendance-table-wrap th {
          position: sticky;
          top: 0;
          z-index: 1;
          white-space: nowrap;
        }

        #attendanceSessionModal .attendance-table-wrap td {
          line-height: 1.45;
        }

        #attendanceSessionModal .attendance-student-name {
          min-width: 11rem;
          color: #f0fdf4;
        }

        #attendanceSessionModal .attendance-table-wrap thead {
          background: linear-gradient(180deg, rgba(18,48,34,.96), rgba(10,29,21,.96));
          border-bottom: 1px solid rgba(74,222,128,.2);
        }

        #attendanceSessionModal .attendance-table-wrap tbody {
          color: #d8f3e0;
        }

        #attendanceSessionModal .attendance-table-wrap tbody tr {
          border-color: rgba(74,222,128,.1);
        }

        #attendanceSessionModal .attendance-table-wrap tbody tr:hover {
          background: rgba(34,197,94,.07);
        }

        @media (max-width: 767px) {
          #attendanceSessionModal .modal-content {
            max-height: 92vh;
          }

          #attendanceSessionModal .attendance-table-wrap {
            max-height: min(45vh, 24rem);
          }

          #attendanceSessionModal .attendance-modal-header,
          #attendanceSessionModal .attendance-modal-body {
            padding-left: 1rem;
            padding-right: 1rem;
          }

          #attendanceSessionModal .attendance-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: .75rem;
          }
        }

        @media (max-width: 430px) {
          #attendanceSessionModal .attendance-summary-grid {
            grid-template-columns: 1fr;
          }

          #attendanceSessionModal .attendance-table-wrap {
            overflow-x: hidden;
            max-height: min(42vh, 22rem);
            border: 0;
            background: transparent;
          }

          #attendanceSessionModal .attendance-detail-table,
          #attendanceSessionModal .attendance-detail-table tbody,
          #attendanceSessionModal .attendance-detail-table tr,
          #attendanceSessionModal .attendance-detail-table td {
            display: block;
            width: 100%;
          }

          #attendanceSessionModal .attendance-detail-table thead {
            display: none;
          }

          #attendanceSessionModal .attendance-detail-table tbody tr {
            margin-bottom: .75rem;
            padding: .35rem .85rem;
            border: 1px solid rgba(74,222,128,.16);
            border-radius: .85rem;
            background: rgba(18,48,34,.62);
          }

          #attendanceSessionModal .attendance-detail-table td {
            display: grid;
            grid-template-columns: 5.5rem minmax(0, 1fr);
            gap: .75rem;
            padding: .55rem 0;
            border-bottom: 1px solid rgba(74,222,128,.1);
          }

          #attendanceSessionModal .attendance-detail-table td:last-child {
            border-bottom: 0;
          }

          #attendanceSessionModal .attendance-detail-table td::before {
            content: attr(data-label);
            color: rgba(167,243,208,.72);
            font-size: .7rem;
            font-weight: 700;
            letter-spacing: .06em;
            text-transform: uppercase;
          }

          #attendanceSessionModal .attendance-student-name {
            min-width: 0;
          }
        }
      </style>

      <div id="attendanceSessionModal" class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-hidden">
          <div class="modal-content relative flex w-full max-w-4xl flex-col">

          <!-- Header (fixed height, non-shrinking) -->
          <div class="attendance-modal-header flex-shrink-0">
            <div class="flex items-center">
              <div class="flex-1">
                <h3 id="attendanceSessionModalTitle" class="text-2xl font-semibold text-white">Attendance Details</h3>
                <p id="attendanceSessionModalSubtitle" class="attendance-modal-subtitle text-sm">Final attendance summary for this completed session.</p>
              </div>
              <div class="ml-4">
                <button type="button" onclick="closeAttendanceSessionModal()" class="attendance-modal-close text-2xl"><i class="fas fa-times"></i></button>
              </div>
            </div>
            <div id="attendanceSessionModalHeaderExtras"></div>
          </div>

          <!-- Modal body keeps the header visible; the student list owns scrolling. -->
          <div id="attendanceSessionModalBody" class="attendance-modal-body flex-1">
            <div id="attendanceSessionModalContent" class="space-y-6"></div>
          </div>
        </div>
      </div>
      <script src="/js/attendance-monitoring.js" defer></script>
    `
  },
  "laboratory-schedules": {
    title: "Laboratory Schedules",
    description: "",
    backRoute: "/admin-dashboard",
    backLabel: "Back to Admin Dashboard",
    content: `
      <style>
        .page-hero-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          min-height: 72px;
          padding: 0.7rem 0.95rem;
          border-radius: 24px;
          border: 1px solid rgba(74,222,128,.24);
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          box-shadow: 0 12px 35px rgba(6,64,43,.18);
          backdrop-filter: blur(16px) saturate(1.04);
          margin: 0.6rem 0 0.7rem;
        }
        .page-hero-meta {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .page-eyebrow {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(110, 231, 183, 0.72);
          margin: 0;
        }
        .page-title {
          font-size: 2rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .page-subtitle {
          color: #cbd5e1;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
          max-width: 44rem;
        }
        .page-hero-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 1rem;
          background: rgba(16,87,55,.35);
          color: #86efac;
          border: 1px solid rgba(74,222,128,.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
          flex-shrink: 0;
        }
        body.app-shell .page-content {
          background: linear-gradient(180deg, rgba(4, 14, 10, 0.98), rgba(2, 9, 6, 0.98)) !important;
          border-radius: 24px;
          padding: 0.7rem 0.85rem 0.85rem;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
        }
        .page-content .card,
        .page-content .card.sm,
        .page-content .page-hero-card {
          background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96)) !important;
          border: 1px solid rgba(74,222,128,.16) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 12px 35px rgba(6,64,43,.18) !important;
          color: #f8fafc !important;
          padding: 0.8rem !important;
        }
        .page-content .card.sm {
          padding: 0.75rem !important;
        }
        .page-content .card-header {
          margin-bottom: 0.6rem !important;
        }
        .page-content .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 42px rgba(34,197,94,.16);
          border-color: rgba(74,222,128,.38) !important;
        }
        .page-content .card-title {
          color: #d1fae5 !important;
          letter-spacing: 0.16em;
        }
        .page-content .card .text-gray-400,
        .page-content .card .text-slate-400,
        .page-content .card .text-gray-500,
        .page-content .card .text-slate-300 {
          color: #d8f5e0 !important;
        }
        .page-content .card-icon {
          background: rgba(16,87,55,.35) !important;
          color: #86efac !important;
          border: 1px solid rgba(74,222,128,.24) !important;
        }
        .page-content .card .rounded-2xl.border-dashed,
        .page-content .card .rounded-2xl.border,
        .page-content .card .rounded-3xl {
          background: linear-gradient(180deg, rgba(8,24,18,.9), rgba(6,16,12,.88)) !important;
          border-color: rgba(74,222,128,.18) !important;
        }
        #scheduleGrid {
          gap: 1rem !important;
        }
        .schedule-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
          margin: 0 0 0.85rem;
        }
        .schedule-summary-card {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 120px;
          padding: 1.25rem;
          border-radius: 1rem;
          border: 1px solid rgba(16,185,129,.2);
          background: rgba(2,40,20,.6);
          box-shadow: 0 10px 25px rgba(2,40,20,.2);
          backdrop-filter: blur(12px);
        }
        .schedule-summary-card--next {
          border-color: rgba(74,222,128,.4);
        }
        .schedule-summary-card--wide {
          min-height: 120px;
        }
        .schedule-summary-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .schedule-summary-label {
          margin: 0;
          color: #bbf7d0;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1.3;
        }
        .schedule-summary-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.3rem;
          height: 2.3rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(74,222,128,.22);
          background: rgba(16,87,55,.28);
          color: #86efac;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .schedule-summary-value {
          margin: 0.4rem 0 0;
          color: #f8fafc;
          font-size: clamp(1.5rem, 2.5vw, 2.1rem);
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        .schedule-summary-detail {
          margin: 0.5rem 0 0;
          color: #d9f9e6;
          font-size: 0.76rem;
          line-height: 1.5;
          font-weight: 600;
        }
        .schedule-summary-detail strong {
          color: #f8fafc;
          font-weight: 700;
        }
        .schedule-manager-card {
          padding: 1rem 1.05rem 0.85rem;
          border-radius: 1.25rem;
          border: 1px solid rgba(74,222,128,.16);
          background: linear-gradient(180deg, rgba(13, 31, 23, 0.96), rgba(8, 20, 15, 0.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 10px 28px rgba(6,64,43,.12);
        }
        .schedule-manager-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.9rem;
          margin-bottom: 0.9rem;
        }
        .schedule-manager-title {
          margin: 0;
          color: #f8fafc;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .schedule-manager-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.7rem 0.95rem;
          border-radius: 0.95rem;
          border: 1px solid rgba(74,222,128,.2);
          background: linear-gradient(180deg, rgba(22,163,74,.95), rgba(21,128,61,.95));
          color: #f8fafc;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: 0 8px 18px rgba(34,197,94,.14);
        }
        .schedule-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.7rem;
          margin-bottom: 0.95rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid rgba(74,222,128,.1);
        }
        .schedule-search-wrap {
          position: relative;
          flex: 1 1 220px;
          min-width: 180px;
        }
        .schedule-search-wrap i {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: #bbf7d0;
          font-size: 0.8rem;
        }
        .schedule-filter,
        .schedule-search {
          height: 2.6rem;
          border-radius: 0.9rem;
          border: 1px solid rgba(74,222,128,.18);
          background: rgba(11, 26, 19, 0.72);
          color: #f8fafc;
          font-size: 0.82rem;
          padding: 0 0.9rem;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
        }
        .schedule-search {
          width: 100%;
          padding-left: 2.2rem;
        }
        .schedule-filter {
          min-width: 130px;
        }
        .schedule-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(71, 85, 105, 0.7);
          border-radius: 1rem;
          background: rgba(2, 6, 23, 0.4);
          scrollbar-color: rgba(34,197,94,.45) rgba(2,6,23,.45);
        }
        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }
        .schedule-table thead {
          background: rgba(15, 23, 42, 0.7);
        }
        .schedule-table th,
        .schedule-table td {
          padding: 0.8rem 0.9rem;
          border-bottom: 1px solid rgba(74,222,128,.09);
          vertical-align: top;
          text-align: left;
        }
        .schedule-table th {
          color: #cbd5e1;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .schedule-table td {
          color: #e2e8f0;
          font-size: 0.82rem;
          line-height: 1.5;
        }
        .schedule-table th:nth-child(1),
        .schedule-table th:nth-child(3),
        .schedule-table th:nth-child(6),
        .schedule-table th:nth-child(7),
        .schedule-table th:nth-child(8),
        .schedule-table td:nth-child(1),
        .schedule-table td:nth-child(3),
        .schedule-table td:nth-child(6),
        .schedule-table td:nth-child(7),
        .schedule-table td:nth-child(8) {
          white-space: nowrap;
        }
        .schedule-table tbody tr {
          transition: background-color 150ms ease;
        }
        .schedule-table tbody tr:hover {
          background: rgba(2,40,20,.3);
        }
        .schedule-table .schedule-row-subject {
          font-weight: 700;
          color: #f8fafc;
        }
        .schedule-row-meta {
          color: #a7f3d0;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .schedule-action-group {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .schedule-action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.1rem;
          height: 2.1rem;
          border-radius: 0.7rem;
          border: 1px solid rgba(74,222,128,.18);
          background: rgba(10, 20, 16, 0.82);
          color: #d1fae5;
          transition: all 150ms ease;
        }
        .schedule-action-button:hover {
          background: rgba(34,197,94,.12);
          border-color: rgba(74,222,128,.34);
        }
        .schedule-action-button--danger {
          border-color: rgba(248,113,113,.22);
          color: #fecaca;
        }
        .schedule-action-button--danger:hover {
          background: rgba(239,68,68,.12);
          border-color: rgba(248,113,113,.32);
        }
        #schedulePagination {
          margin-top: 0.75rem;
          gap: 0.45rem;
          padding-top: 0.1rem;
          justify-content: flex-end;
        }
        #scheduleModal .w-full,
        #qrModal .w-full,
        #scheduleModal .rounded-3xl,
        #qrModal .rounded-3xl {
          background: linear-gradient(180deg, rgba(13,23,18,.98), rgba(10,18,14,.96)) !important;
          border: 1px solid rgba(74,222,128,.24) !important;
          box-shadow: 0 16px 40px rgba(6,64,43,.22) !important;
        }
        #scheduleModal input,
        #scheduleModal select,
        #scheduleModal textarea,
        #qrModal input,
        #qrModal select,
        #qrModal textarea {
          background: rgba(6,14,10,.94) !important;
          border: 1px solid rgba(74,222,128,.28) !important;
          color: #f8fafc !important;
        }
        #scheduleModal input::placeholder,
        #scheduleModal textarea::placeholder {
          color: #86efac !important;
        }
        @media (max-width: 767px) {
          .schedule-summary-grid {
            grid-template-columns: 1fr;
          }
          .schedule-manager-header {
            align-items: flex-start;
            flex-direction: column;
          }
          .schedule-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .schedule-search-wrap,
          .schedule-filter {
            width: 100%;
          }
        }
      </style>
      <section class="schedule-summary-grid">
        <div class="schedule-summary-card schedule-summary-card--wide schedule-summary-card--next card bg-[#022814]/60 border border-emerald-400/40 rounded-2xl p-5 shadow-lg shadow-emerald-950/20 backdrop-blur-md">
          <div class="schedule-summary-header">
            <div>
              <p class="schedule-summary-label">Next Session</p>
            </div>
            <div class="schedule-summary-icon"><i class="fas fa-flask"></i></div>
          </div>
          <div>
            <h2 id="nextSessionTitle" class="schedule-summary-value">No upcoming sessions</h2>
            <p id="nextSessionMeta" class="schedule-summary-detail">No laboratory schedules available.</p>
          </div>
        </div>
        <div class="schedule-summary-card card bg-[#022814]/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-950/20 backdrop-blur-md">
          <div class="schedule-summary-header">
            <div>
              <p class="schedule-summary-label">Available Rooms</p>
            </div>
            <div class="schedule-summary-icon"><i class="fas fa-door-open"></i></div>
          </div>
          <h2 id="availableRoomsCount" class="schedule-summary-value">0</h2>
        </div>
        <div class="schedule-summary-card card bg-[#022814]/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-950/20 backdrop-blur-md">
          <div class="schedule-summary-header">
            <div>
              <p class="schedule-summary-label">Confirmed Labs</p>
            </div>
            <div class="schedule-summary-icon"><i class="fas fa-calendar-check"></i></div>
          </div>
          <h2 id="confirmedLabsCount" class="schedule-summary-value">0</h2>
        </div>
      </section>
      <section class="schedule-manager-card card">
        <div class="schedule-manager-header">
          <h3 class="schedule-manager-title">Weekly Schedule</h3>
          <button id="openScheduleModalBtn" type="button" class="schedule-manager-button" onclick="window.openScheduleModal && window.openScheduleModal()">
            <i class="fas fa-plus"></i> Add Schedule
          </button>
        </div>
        <div class="schedule-toolbar">
          <div class="schedule-search-wrap">
            <i class="fas fa-search"></i>
            <input id="scheduleSearch" type="search" placeholder="Search Schedule" class="schedule-search" />
          </div>
          <select id="scheduleFilterDay" class="schedule-filter">
            <option value="">All Days</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Sunday">Sunday</option>
          </select>
          <select id="scheduleFilterCampus" class="schedule-filter">
            <option value="">All Campuses</option>
            <option value="Bongabong">Bongabong Campus</option>
            <option value="Calapan">Calapan Campus</option>
            <option value="Victoria">Victoria Campus</option>
          </select>
          <select id="scheduleFilterRoom" class="schedule-filter">
            <option value="">All Rooms</option>
            <option value="Laboratory 1 — Room 202">Lab 1 — Room 202</option>
            <option value="Laboratory 2 — Room 204">Lab 2 — Room 204</option>
          </select>
        </div>

        <div class="schedule-table-wrap">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Laboratory Room</th>
                <th>Time</th>
                <th>Subject / Class</th>
                <th>Instructor</th>
                <th>Campus</th>
                <th>Roster</th>
                <th class="min-w-[220px]">Actions</th>
              </tr>
            </thead>
            <tbody id="scheduleTableBody"></tbody>
          </table>
        </div>

        <div id="schedulePagination" class="mt-3 flex items-center justify-end gap-2"></div>
      </section>

      <div id="scheduleModal" class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-hidden">
        <div class="modal-content mx-auto w-full max-w-2xl rounded-3xl border-2 border-emerald-800/60 bg-[#0d1712] p-6 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div class="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 id="scheduleModalTitle" class="text-2xl font-semibold text-white">Add Lab Schedule</h3>
              <p id="scheduleModalSubtitle" class="text-sm text-gray-400">Create a new session and assign it to a weekday.</p>
            </div>
            <button id="closeScheduleModalBtn" type="button" onclick="window.closeScheduleModal && window.closeScheduleModal()" class="text-gray-400 hover:text-white text-2xl">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form id="scheduleForm" class="flex flex-col flex-1 min-h-0" onsubmit="handleScheduleSubmit(event)" enctype="multipart/form-data">
            <div class="modal-body overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Day</label>
                  <select id="scheduleDay" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" required>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Laboratory Room</label>
                  <select id="scheduleRoom" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" required>
                    <option value="">Select Laboratory Room</option>
                    <option value="Laboratory 1 — Room 202">Laboratory 1 — Room 202</option>
                    <option value="Laboratory 2 — Room 204">Laboratory 2 — Room 204</option>
                  </select>
                </div>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                  <input id="scheduleTitle" type="text" placeholder="e.g., Circuit Design" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Instructor</label>
                  <input id="scheduleInstructor" type="text" placeholder="e.g., Prof. Santos" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" />
                </div>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Campus</label>
                  <input id="scheduleCampus" type="text" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" readonly required aria-readonly="true" />
                </div>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                  <input id="scheduleStartTime" type="text" placeholder="9:00 AM" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                  <input id="scheduleEndTime" type="text" placeholder="11:00 AM" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none" required />
                </div>
              </div>
              <div class="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] backdrop-blur-sm">
                <div class="flex items-start gap-3">
                  <div class="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200">
                    <i class="fas fa-file-upload"></i>
                  </div>
                  <div class="flex-1">
                    <h4 class="text-lg font-semibold text-white">Student Class List</h4>
                    <p class="mt-1 text-sm text-emerald-100/80">Upload the official class list for this laboratory schedule.</p>
                    <p class="mt-2 text-sm text-slate-300">Accepted file formats: .xlsx, .xls, .csv</p>
                    <label class="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-emerald-500/40 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-slate-900">
                      <i class="fas fa-cloud-upload-alt"></i>
                      <span>Choose File</span>
                      <input id="scheduleClassListFile" type="file" accept=".csv,.xlsx,.xls" onchange="window.handleClassListFileChange && window.handleClassListFileChange(this.files)" class="hidden" />
                    </label>
                    <div id="scheduleClassListStatus" class="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-3 text-sm text-slate-300">
                      <div id="scheduleClassListMessage" class="text-slate-400">No class list selected.</div>
                      <div id="scheduleClassListMeta" class="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400"></div>
                    </div>
                    <div id="scheduleClassListValidation" class="mt-3 hidden rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      Please upload the official class list before creating the laboratory schedule.
                    </div>
                  </div>
                </div>
              </div>
              <label class="flex items-center gap-3 text-sm text-gray-300">
                <input id="scheduleQrEnabled" type="checkbox" class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-green-600 focus:ring-green-500" />
                Enable attendance QR
              </label>
            </div>
            <div class="modal-footer flex flex-col sm:flex-row gap-3 pt-3 border-t border-emerald-800/20 mt-3">
              <button type="button" onclick="closeScheduleModal && closeScheduleModal()" class="flex-1 rounded-2xl border border-slate-700 bg-transparent px-4 py-3 text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="submit" id="scheduleSubmitButton" class="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-white hover:bg-green-700">Save Schedule</button>
            </div>
          </form>
        </div>
      </div>

      <div id="qrModal" class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-hidden">
        <div class="modal-content mx-auto w-full max-w-2xl rounded-3xl border-2 border-emerald-800/60 bg-[#0d1712] p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div class="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 class="text-2xl font-semibold text-white">Attendance QR</h3>
                <p id="qrModalSubtitle" class="text-sm text-gray-400">Generate a one-time QR for this lab session.</p>
              </div>
              <button onclick="closeQrModal()" class="text-gray-400 hover:text-white text-2xl">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="space-y-4">
              <div class="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">QR Expiration</label>
                  <select id="qrExpirySelect" class="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white focus:border-green-500 focus:outline-none">
                    <option value="10">10 minutes</option>
                    <option value="15" selected>15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <button type="button" onclick="event.preventDefault(); generateCurrentQr();" class="w-full rounded-2xl bg-green-600 px-4 py-3 text-white hover:bg-green-700">Generate QR</button>
                </div>
              </div>
                <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div id="qrPreview" class="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-gray-400">No QR generated yet.</div>
                <div class="mt-4 flex flex-wrap gap-3">
                  <button type="button" onclick="downloadCurrentQr()" class="rounded-2xl border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Download QR</button>
                  <button type="button" onclick="printCurrentQr()" class="rounded-2xl border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Print QR</button>
                  <button type="button" onclick="regenerateCurrentQr()" class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20">Regenerate QR</button>
                </div>
                <div id="qrStatusRow" class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-gray-300">
                  <span>QR Status</span>
                  <span id="qrStatusBadge" class="rounded-full bg-slate-600/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Expired</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          #scheduleModal.show,
          #qrModal.show,
          #attendanceSessionModal.show,
          #userModal.show {
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              overflow: auto !important;
          }
          @media (max-width: 768px) {
            #scheduleModal.show,
            #qrModal.show,
            #attendanceSessionModal.show,
            #userModal.show {
              align-items: flex-start !important;
              padding-top: 1.5rem !important;
              padding-bottom: 1.5rem !important;
            }
          }
          /* Ensure modal content is a column and inner content scrolls while footer/action row stays visible */
          #scheduleModal .modal-content,
          #qrModal .modal-content,
          #attendanceSessionModal .modal-content,
          #userModal .modal-content {
              display: flex !important;
              flex-direction: column !important;
          }
          #scheduleModal .modal-content > .space-y-4,
          #qrModal .modal-content > .space-y-4,
          #attendanceSessionModal .modal-content > .space-y-4,
          #userModal .modal-content > .space-y-4 {
              overflow: auto !important;
              flex: 1 1 auto !important;
              padding-right: 0.5rem !important;
          }
          /* Pin the QR action buttons/footer to bottom of modal when scrolling */
          #qrModal .qr-actions,
          #scheduleModal .modal-footer,
          #attendanceSessionModal .modal-footer {
              position: sticky !important;
              bottom: 0 !important;
              background: linear-gradient(180deg, rgba(13,23,18,.98), rgba(10,18,14,.96)) !important;
              padding-top: 0.6rem !important;
              padding-bottom: 0.6rem !important;
              z-index: 20 !important;
          }
        #scheduleModal.hidden,
        #qrModal.hidden,
        #attendanceSessionModal.hidden,
        #userModal.hidden {
            display: none;
        }
        .modal-content {
            width: min(100%, 46rem);
            max-width: 46rem;
            max-height: 85vh;
            overflow: hidden;
            background: rgba(13,23,18,0.96);
            border: 2px solid rgba(16,185,129,0.35);
            box-shadow: 0 24px 60px rgba(6,64,43,0.35);
        }
        .modal-content[style*="overflow-y-auto"],
        .modal-content .form-inner,
        .modal-content .space-y-4 {
            max-height: 85vh;
            overflow-y: auto;
        }
        .modal-content::-webkit-scrollbar,
        .modal-content .form-inner::-webkit-scrollbar {
            width: 10px;
        }
        .modal-content::-webkit-scrollbar-thumb,
        .modal-content .form-inner::-webkit-scrollbar-thumb {
            background: rgba(16,185,129,0.35);
            border-radius: 999px;
        }
        /* Constrain QR preview images to avoid modal scrolling */
        #qrPreview img,
        #qrPreview canvas,
        #qrPreview svg {
          max-width: 320px !important;
          max-height: 320px !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
        }
        </style>

        <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.3/dist/xlsx.full.min.js"></script>
        <script>
          let activeQrScheduleIndex = null;
          let scheduleData = [];
          let schedulePaginationState = {
            currentPage: 1,
            rowsPerPage: 5,
            totalPages: 1
          };
          let editingScheduleId = null;

          function getStatusBadge(status) {
            const map = {
              Confirmed: 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40',
              'In Progress': 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40',
              Pending: 'bg-emerald-950/40 text-amber-200 border border-amber-700/30'
            };
            return map[status] || 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40';
          }

          function getQrStatus(item) {
            if (!item || !item.qr || !item.qr.url) return 'Not generated';
            return item.qr.expiresAt && item.qr.expiresAt > Date.now() ? 'Active' : 'Expired';
          }

          function getQrStatusClass(item) {
            const status = getQrStatus(item);
            if (status === 'Active') return 'bg-emerald-500/10 text-emerald-200';
            if (status === 'Not generated') return 'bg-slate-600/70 text-slate-200';
            return 'bg-amber-500/10 text-amber-200';
          }

          const attendanceMonitorEndpoint = '/api/instructor/attendance-dashboard';
          const attendanceMonitorStatsEndpoint = '/api/attendance/stats';
          const attendanceSessionEndpoint = '/api/attendance/session';
          let attendanceSessions = [];
          let attendanceRefreshId = null;
          let attendanceTablePaginationState = {
            currentPage: 1,
            rowsPerPage: 3,
            totalPages: 1
          };

          async function fetchAttendanceStats() {
            const totalSessionsEl = document.getElementById('totalSessionsValue');
            const presentTodayEl = document.getElementById('presentTodayValue');
            const absentTodayEl = document.getElementById('absentTodayValue');
            const lateTodayEl = document.getElementById('lateTodayValue');
            if (!totalSessionsEl) {
              return;
            }

            try {
              const response = await fetch(attendanceMonitorStatsEndpoint, { cache: 'no-store' });
              if (!response.ok) throw new Error('Failed to load attendance stats');
              const stats = await response.json();
              totalSessionsEl.textContent = stats.total ?? 0;
              if (presentTodayEl) presentTodayEl.textContent = stats.present ?? 0;
              if (absentTodayEl) absentTodayEl.textContent = stats.absent ?? 0;
              if (lateTodayEl) lateTodayEl.textContent = stats.late ?? 0;
            } catch (err) {
              console.error(err);
            }
          }

          async function fetchAttendanceRecords() {
            const tbody = document.getElementById('attendanceMonitorTableBody');
            if (!tbody) {
              return;
            }

            try {
              const response = await fetch(attendanceMonitorEndpoint, { cache: 'no-store' });
              if (!response.ok) throw new Error('Failed to load attendance sessions');
              const payload = await response.json();
              attendanceSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
              renderAttendanceSessionTable(attendanceSessions);
            } catch (err) {
              console.error(err);
            }
          }

          function getAttendanceStatusClass(status) {
            const value = (status || '').toLowerCase();
            if (value === 'late') return 'bg-amber-500/10 text-amber-200';
            if (value === 'absent') return 'bg-red-500/10 text-red-200';
            return 'bg-emerald-500/10 text-emerald-200';
          }

          function formatSessionDate(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '—';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }

          function renderAttendanceTablePagination(filteredSessions) {
            const paginationContainer = document.getElementById('attendancePagination');
            const paginationInfo = document.getElementById('attendancePaginationInfo');
            if (!paginationContainer) return;

            const totalPages = Math.max(1, Math.ceil(filteredSessions.length / attendanceTablePaginationState.rowsPerPage));
            attendanceTablePaginationState.totalPages = totalPages;
            attendanceTablePaginationState.currentPage = Math.min(attendanceTablePaginationState.currentPage, totalPages);

            if (paginationInfo) {
              if (!filteredSessions.length) {
                paginationInfo.textContent = 'Showing 0 of 0';
              } else {
                const startIndex = (attendanceTablePaginationState.currentPage - 1) * attendanceTablePaginationState.rowsPerPage + 1;
                const endIndex = Math.min(attendanceTablePaginationState.currentPage * attendanceTablePaginationState.rowsPerPage, filteredSessions.length);
                paginationInfo.textContent = 'Showing ' + startIndex + '-' + endIndex + ' of ' + filteredSessions.length;
              }
            }

            if (totalPages <= 1) {
              paginationContainer.innerHTML = '';
              return;
            }

            const createButton = (label, page, isActive) => {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = label;
              button.className = 'attendance-pagination-btn';
              if (isActive) button.classList.add('active');

              button.disabled = page < 1 || page > totalPages || (label === 'Previous' && attendanceTablePaginationState.currentPage <= 1) || (label === 'Next' && attendanceTablePaginationState.currentPage >= totalPages);
              button.addEventListener('click', () => {
                if (page >= 1 && page <= totalPages) {
                  attendanceTablePaginationState.currentPage = page;
                  renderAttendanceSessionTable(attendanceSessions);
                }
              });
              return button;
            };

            paginationContainer.innerHTML = '';
            paginationContainer.appendChild(createButton('Previous', attendanceTablePaginationState.currentPage - 1, false));

            const visiblePages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => index + 1);
            visiblePages.forEach((page) => {
              paginationContainer.appendChild(createButton(String(page), page, page === attendanceTablePaginationState.currentPage));
            });

            paginationContainer.appendChild(createButton('Next', attendanceTablePaginationState.currentPage + 1, false));
          }

          function renderAttendanceSessionTable(sessions) {
            const tbody = document.getElementById('attendanceMonitorTableBody');
            if (!tbody) return;
            if (!sessions.length) {
              tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">No completed attendance sessions available yet.</td></tr>';
              const paginationContainer = document.getElementById('attendancePagination');
              if (paginationContainer) paginationContainer.innerHTML = '';
              const paginationInfo = document.getElementById('attendancePaginationInfo');
              if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0';
              return;
            }

            const filterValue = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';
            const filtered = sessions.filter((session) => {
              const content = ((session.subject || '') + ' ' + (session.laboratory || '') + ' ' + (session.instructor || '')).toLowerCase();
              return !filterValue || content.includes(filterValue);
            }).sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

            const totalPages = Math.max(1, Math.ceil(filtered.length / attendanceTablePaginationState.rowsPerPage));
            attendanceTablePaginationState.totalPages = totalPages;
            attendanceTablePaginationState.currentPage = Math.min(attendanceTablePaginationState.currentPage, totalPages);

            const startIndex = (attendanceTablePaginationState.currentPage - 1) * attendanceTablePaginationState.rowsPerPage;
            const pagedSessions = filtered.slice(startIndex, startIndex + attendanceTablePaginationState.rowsPerPage);

            tbody.innerHTML = '';
            pagedSessions.forEach((session) => {
              const row = document.createElement('tr');
              row.className = 'hover:bg-slate-900/70';
              const timeLabel = [session.startTime, session.endTime].filter(Boolean).join(' - ') || session.time || '—';
              const countsLabel = 'P:' + (session.studentsPresent ?? 0) + ' • L:' + (session.studentsLate ?? 0) + ' • A:' + (session.studentsAbsent ?? 0);
              row.innerHTML =
                '<td class="px-4 py-4 text-white">' + (session.subject || '—') + '</td>' +
                '<td class="px-4 py-4">' + (session.laboratory || '—') + '</td>' +
                '<td class="px-4 py-4">' + (session.instructor || '—') + '</td>' +
                '<td class="px-4 py-4">' + formatSessionDate(session.date || session.createdAt) + '</td>' +
                '<td class="px-4 py-4">' + (timeLabel || '—') + '</td>' +
                '<td class="px-4 py-4">' + countsLabel + '</td>' +
                '<td class="px-4 py-4"><button type="button" class="view-details inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"><i class="fas fa-eye"></i> View Details</button></td>';
              tbody.appendChild(row);
              const viewBtn = row.querySelector('button.view-details');
              if (viewBtn) {
                viewBtn.addEventListener('click', function () {
                  try { openAttendanceSessionModal(session.id || session.token || ''); } catch (e) { console.error(e); }
                });
              }
            });

            renderAttendanceTablePagination(filtered);
          }

          function attachAttendanceFilters() {
            const searchInput = document.getElementById('attendanceSearch');
            if (searchInput) {
              searchInput.addEventListener('input', () => {
                attendanceTablePaginationState.currentPage = 1;
                renderAttendanceSessionTable(attendanceSessions);
              });
            }
          }

          function attachScheduleFilters() {
            const search = document.getElementById('scheduleSearch');
            const day = document.getElementById('scheduleFilterDay');
            const campus = document.getElementById('scheduleFilterCampus');
            const room = document.getElementById('scheduleFilterRoom');
            if (search && !search._attached) {
              search.addEventListener('input', () => { schedulePaginationState.currentPage = 1; renderSchedules(); });
              search._attached = true;
            }
            if (day && !day._attached) {
              day.addEventListener('change', () => { schedulePaginationState.currentPage = 1; renderSchedules(); });
              day._attached = true;
            }
            if (campus && !campus._attached) {
              campus.addEventListener('change', () => { schedulePaginationState.currentPage = 1; renderSchedules(); });
              campus._attached = true;
            }
            if (room && !room._attached) {
              room.addEventListener('change', () => { schedulePaginationState.currentPage = 1; renderSchedules(); });
              room._attached = true;
            }
          }

          function normalizeScheduleFilterValue(value) {
            if (value === null || value === undefined) return '';
            return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
          }

          function roomMatchesFilter(actualRoom, expectedRoom) {
            const actual = normalizeScheduleFilterValue(actualRoom);
            const expected = normalizeScheduleFilterValue(expectedRoom);
            if (!actual || !expected) return !actual && !expected;
            if (actual === expected) return true;

            const aliases = {
              'room 201': 'laboratory 1 room 202',
              'room 202': 'laboratory 1 room 202',
              'room 203': 'laboratory 2 room 204',
              'room 204': 'laboratory 2 room 204',
              'lab 1': 'laboratory 1 room 202',
              'lab 2': 'laboratory 2 room 204',
              'laboratory 1': 'laboratory 1 room 202',
              'laboratory 2': 'laboratory 2 room 204',
              'bongabong campus': 'bongabong',
              'calapan campus': 'calapan',
              'victoria campus': 'victoria'
            };

            return actual === aliases[expected] || expected === aliases[actual] || actual.includes(expected) || expected.includes(actual);
          }

          function campusMatchesFilter(actualCampus, expectedCampus) {
            const actual = normalizeScheduleFilterValue(actualCampus);
            const expected = normalizeScheduleFilterValue(expectedCampus);
            if (!actual || !expected) return !actual && !expected;
            if (actual === expected) return true;
            if (actual === 'bongabong campus') return expected === 'bongabong';
            if (expected === 'bongabong campus') return actual === 'bongabong';
            return actual.includes(expected) || expected.includes(actual);
          }

          function getScheduleListFromPayload(payload) {
            if (Array.isArray(payload)) return payload;
            if (!payload || typeof payload !== 'object') return [];
            const candidates = [
              payload.schedules,
              payload.data,
              payload.items,
              payload.results,
              payload.rows,
              payload.schedule
            ];
            for (const entry of candidates) {
              if (Array.isArray(entry)) return entry;
            }
            return [];
          }

          function normalizeScheduleRecord(item) {
            if (!item || typeof item !== 'object') return null;
            return {
              ...item,
              id: item.id ?? null,
              subject: item.subject || item.title || '',
              instructor: item.instructor || '',
              laboratoryRoom: item.laboratoryRoom || item.room || '',
              campus: item.campus || '',
              dayOfWeek: item.dayOfWeek || item.day || '',
              startTime: item.startTime || '',
              endTime: item.endTime || '',
              status: item.status || 'Confirmed',
              qrEnabled: Boolean(item.qrEnabled)
            };
          }

          function getScheduleById(id) {
            if (id === null || id === undefined || id === '') return null;
            const targetId = String(id);
            return scheduleData.find((schedule) => String(schedule.id) === targetId) || null;
          }

          function normalizeScheduleForQr(item) {
            const schedule = normalizeScheduleRecord(item);
            if (!schedule) return null;
            const timeLabel = [schedule.startTime, schedule.endTime].filter(Boolean).join(' - ');
            return {
              ...schedule,
              title: schedule.subject || 'Untitled Session',
              subject: schedule.subject || 'Untitled Session',
              laboratoryRoom: schedule.laboratoryRoom || 'No room',
              dayOfWeek: schedule.dayOfWeek || 'Monday',
              startTime: schedule.startTime || '',
              endTime: schedule.endTime || '',
              campus: schedule.campus || 'Main Campus',
              instructor: schedule.instructor || 'No instructor',
              status: schedule.status || 'Confirmed',
              day: schedule.dayOfWeek || 'Monday',
              time: timeLabel || '',
              room: schedule.laboratoryRoom || 'No room'
            };
          }

          async function createAttendanceSession(item, minutes) {
            const normalizedItem = normalizeScheduleForQr(item);
            try {
              const response = await fetch(attendanceSessionEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  scheduleId: normalizedItem.id,
                  expirationMinutes: minutes
                })
              });

              if (!response.ok) {
                const payload = await response.json().catch(() => null);
                const message = payload?.error || payload?.message || 'Unable to create attendance session';
                throw new Error(message);
              }

              return await response.json();
            } catch (err) {
              console.error('Failed to generate attendance QR.');
              console.error(err?.stack || err);
              alert(err?.message || 'Unable to generate attendance QR.');
              return null;
            }
          }

          function buildQrPayload(item, minutes) {
            const token = 'lab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            return {
              token,
              url: window.location.origin + '/api/attendance/scan?token=' + token,
              payload: '',
              title: item.title,
              room: item.room,
              day: item.day,
              time: item.time,
              minutes: minutes,
              generatedAt: new Date().toISOString()
            };
          }

          async function fetchSchedules() {
            try {
              scheduleData = [];
              schedulePaginationState.currentPage = 1;
              renderSchedules();

              const response = await fetch('/api/laboratory-schedules', { cache: 'no-store', credentials: 'same-origin' });
              if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload?.error || 'Failed to load schedules');
              }

              const payload = await response.json();
              const rawSchedules = getScheduleListFromPayload(payload);
              scheduleData = rawSchedules
                .map((item) => normalizeScheduleRecord(item))
                .filter(Boolean)
                .filter((item) => {
                  const activeCampus = normalizeScheduleFilterValue(window.__CURRENT_USER_CAMPUS__);
                  return !activeCampus || campusMatchesFilter(item.campus, activeCampus);
                });

              schedulePaginationState.currentPage = 1;
              try { attachScheduleFilters(); } catch (e) {}
              renderSchedules();
            } catch (err) {
              console.error(err);
              scheduleData = [];
              schedulePaginationState.currentPage = 1;
              renderSchedules();
            }
          }

          async function confirmScheduleDeletion(id) {
            if (!window.confirm('Are you sure you want to delete this laboratory schedule?')) return;
            try {
              const response = await fetch('/api/laboratory-schedules/' + encodeURIComponent(id), { method: 'DELETE' });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(payload.error || 'Unable to delete schedule');
              scheduleData = scheduleData.filter((item) => String(item.id) !== String(id));
              renderSchedules();
              window.alert('Schedule deleted successfully.');
            } catch (err) {
              console.error(err);
              window.alert(err.message || 'Unable to delete schedule.');
            }
          }

          function renderScheduleSummary() {
            const nextTitle = document.getElementById('nextSessionTitle');
            const nextMeta = document.getElementById('nextSessionMeta');
            const availableRooms = document.getElementById('availableRoomsCount');
            const confirmedLabs = document.getElementById('confirmedLabsCount');

            if (!nextTitle || !nextMeta || !availableRooms || !confirmedLabs) return;

            const confirmedCount = scheduleData.filter((item) => (item.status || 'Confirmed') === 'Confirmed').length;
            const roomSet = new Set(scheduleData.map((item) => item.laboratoryRoom).filter(Boolean));
            const upcoming = [...scheduleData]
              .filter((item) => item.dayOfWeek && item.startTime)
              .sort((a, b) => {
                const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const dayDiff = (dayOrder.indexOf(a.dayOfWeek) + 7) % 7 - (dayOrder.indexOf(b.dayOfWeek) + 7) % 7;
                if (dayDiff !== 0) return dayDiff;
                return String(a.startTime).localeCompare(String(b.startTime));
              })[0];

            availableRooms.textContent = roomSet.size;
            confirmedLabs.textContent = confirmedCount;

            if (upcoming) {
              nextTitle.textContent = upcoming.subject || 'Untitled Session';
              nextMeta.textContent = upcoming.dayOfWeek + ' • ' + upcoming.startTime + ' - ' + upcoming.endTime + ' • ' + (upcoming.laboratoryRoom || 'No room');
              nextMeta.className = 'mt-2 text-sm font-semibold text-lime-300';
            } else {
              nextTitle.textContent = 'No upcoming sessions';
              nextMeta.textContent = 'No laboratory schedules available.';
              nextMeta.className = 'mt-2 text-sm font-semibold text-lime-300';
            }
          }

          function renderSchedules() {
            const tableBody = document.getElementById('scheduleTableBody');
            const paginationContainer = document.getElementById('schedulePagination');
            if (!tableBody) return;

            const searchValue = (document.getElementById('scheduleSearch')?.value || '').trim().toLowerCase();
            const dayFilter = document.getElementById('scheduleFilterDay')?.value || '';
            const campusFilter = document.getElementById('scheduleFilterCampus')?.value || '';
            const roomFilter = document.getElementById('scheduleFilterRoom')?.value || '';

            if (!scheduleData.length && !searchValue && !dayFilter && !campusFilter && !roomFilter) {
              tableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-300">Loading schedules...</td></tr>';
              if (paginationContainer) paginationContainer.innerHTML = '';
              renderScheduleSummary();
              return;
            }

            const filteredSchedules = scheduleData.filter((item) => {
              const subject = item.subject || '';
              const instructor = item.instructor || '';
              const labRoom = item.laboratoryRoom || item.room || '';
              const campus = item.campus || '';
              const day = item.dayOfWeek || item.day || '';
              const start = item.startTime || '';
              const end = item.endTime || '';
              const haystack = [subject, instructor, labRoom, campus, day, start, end].join(' ').toLowerCase();

              const matchesSearch = !searchValue || haystack.includes(searchValue);
              const matchesDay = !dayFilter || day === dayFilter;
              const matchesCampus = !campusFilter || campusMatchesFilter(campus, campusFilter);
              const matchesRoom = !roomFilter || roomMatchesFilter(labRoom, roomFilter);
              return matchesSearch && matchesDay && matchesCampus && matchesRoom;
            });

            if (!filteredSchedules.length) {
              tableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-300">No laboratory schedules found.</td></tr>';
              if (paginationContainer) paginationContainer.innerHTML = '';
              renderScheduleSummary();
              return;
            }

            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const orderedSchedules = filteredSchedules.slice().sort((a, b) => {
              const aDay = a.dayOfWeek || a.day || '';
              const bDay = b.dayOfWeek || b.day || '';
              const dayDiff = (dayOrder.indexOf(aDay) === -1 ? 99 : dayOrder.indexOf(aDay)) - (dayOrder.indexOf(bDay) === -1 ? 99 : dayOrder.indexOf(bDay));
              if (dayDiff !== 0) return dayDiff;
              return String(a.startTime || '').localeCompare(String(b.startTime || ''));
            });

            const totalPages = Math.max(1, Math.ceil(orderedSchedules.length / schedulePaginationState.rowsPerPage));
            schedulePaginationState.totalPages = totalPages;
            schedulePaginationState.currentPage = Math.min(schedulePaginationState.currentPage, totalPages);

            const pageStart = (schedulePaginationState.currentPage - 1) * schedulePaginationState.rowsPerPage;
            const pageSchedules = orderedSchedules.slice(pageStart, pageStart + schedulePaginationState.rowsPerPage);

            tableBody.innerHTML = '';
            pageSchedules.forEach((item) => {
              const row = document.createElement('tr');
              row.className = 'hover:bg-emerald-950/30 transition-colors';
              const timeLabel = [item.startTime, item.endTime].filter(Boolean).join(' - ') || '—';
              const rosterCount = Number(item.classListCount || 0);
              row.innerHTML =
                '<td class="px-4 py-4 text-white">' + (item.dayOfWeek || item.day || '—') + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + (item.laboratoryRoom || item.room || '—') + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + timeLabel + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + (item.subject || item.title || 'Untitled Session') + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + (item.instructor || 'No instructor') + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + (item.campus || '—') + '</td>' +
                '<td class="px-4 py-4 text-slate-200">' + rosterCount + ' student' + (rosterCount === 1 ? '' : 's') + '</td>' +
                '<td class="min-w-[220px] px-4 py-4"><div class="flex flex-row items-center justify-end gap-2 whitespace-nowrap">' +
                  '<button type="button" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/30 transition-all" onclick="openQrModal(' + (item.id ?? '') + ')"><i class="fas fa-qrcode"></i> QR</button>' +
                  '<button type="button" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg border border-blue-500/30 transition-all" onclick="openEditScheduleModal(' + (item.id ?? '') + ')"><i class="fas fa-edit"></i> Edit</button>' +
                  '<button type="button" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-all" onclick="confirmScheduleDeletion(' + (item.id ?? '') + ')"><i class="fas fa-trash"></i> Delete</button>' +
                '</div></td>';
              tableBody.appendChild(row);
            });

            renderScheduleSummary();
            renderSchedulePagination(totalPages);
          }

          function getTruncatedPaginationItems(totalPages, currentPage) {
            if (totalPages <= 1) return [];
            if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

            const items = [1];
            if (currentPage <= 2) {
              items.push(2);
              items.push('...');
              items.push(totalPages);
            } else if (currentPage >= totalPages - 1) {
              items.push('...');
              items.push(totalPages - 1);
              items.push(totalPages);
            } else {
              items.push('...');
              items.push(currentPage);
              items.push(currentPage + 1);
              items.push('...');
              items.push(totalPages);
            }
            return items;
          }

          function renderSchedulePagination(totalPages) {
            const paginationContainer = document.getElementById('schedulePagination');
            if (!paginationContainer) return;
            if (totalPages <= 1) {
              paginationContainer.innerHTML = '';
              return;
            }

            const activePage = schedulePaginationState.currentPage;
            paginationContainer.innerHTML = '';

            const createButton = (page, label, isActive, isPageNumber = false) => {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = label;
              button.disabled = page === activePage;

              if (isPageNumber) {
                button.className = isActive
                  ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400 bg-emerald-500 font-bold text-black shadow-[0_0_14px_rgba(34,197,94,.3)] transition'
                  : 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 transition hover:bg-emerald-900/60';
              } else {
                button.className = 'rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-900/50';
              }

              if (button.disabled) {
                button.classList.add('cursor-not-allowed', 'opacity-40');
              } else {
                button.addEventListener('click', function () {
                  schedulePaginationState.currentPage = page;
                  renderSchedules();
                });
              }
              return button;
            };

            const prevButton = createButton(Math.max(1, activePage - 1), 'Previous', false, false);
            prevButton.disabled = activePage <= 1;
            paginationContainer.appendChild(prevButton);

            const visiblePages = getTruncatedPaginationItems(totalPages, activePage);
            visiblePages.forEach((pageItem) => {
              if (pageItem === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'px-1 font-bold text-emerald-500/60';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
                return;
              }

              paginationContainer.appendChild(createButton(pageItem, String(pageItem), pageItem === activePage, true));
            });

            const nextButton = createButton(Math.min(totalPages, activePage + 1), 'Next', false, false);
            nextButton.disabled = activePage >= totalPages;
            paginationContainer.appendChild(nextButton);
          }

          window.openScheduleModal = function openScheduleModal() {
            console.log('[Add Schedule] openScheduleModal() called');
            editingScheduleId = null;
            const form = document.getElementById('scheduleForm');
            if (form) form.reset();
            const campusField = document.getElementById('scheduleCampus');
            const authenticatedCampus = String(window.__CURRENT_USER_CAMPUS__ || '').trim().replace(/\s*Campus\s*$/i, '');
            if (campusField) campusField.value = authenticatedCampus;
            document.getElementById('scheduleModalTitle').textContent = 'Add Lab Schedule';
            document.getElementById('scheduleModalSubtitle').textContent = 'Create a new session and assign it to a weekday.';
            document.getElementById('scheduleSubmitButton').textContent = 'Create Schedule';
            resetClassListUploadState();
            const modal = document.getElementById('scheduleModal');
            console.log('[Add Schedule] Modal element inside openScheduleModal:', modal);
            if (!modal) {
              console.warn('[Add Schedule] scheduleModal element not found - aborting open');
              return;
            }
            console.log('[Add Schedule] Removing hidden and adding display classes');
            modal.classList.remove('hidden');
            modal.classList.add('flex', 'show');
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            // prevent body scrolling when modal is open
            try { document.body.classList.add('overflow-hidden'); } catch (e) {}
            console.log('[Add Schedule] Modal should now be visible.');
          };

          function openEditScheduleModal(scheduleOrId) {
            const schedule = normalizeScheduleRecord(typeof scheduleOrId === 'object' ? scheduleOrId : getScheduleById(scheduleOrId));
            if (!schedule) return;
            editingScheduleId = schedule.id;
            document.getElementById('scheduleModalTitle').textContent = 'Edit Lab Schedule';
            document.getElementById('scheduleModalSubtitle').textContent = 'Update the existing session details.';
            document.getElementById('scheduleSubmitButton').textContent = 'Update Schedule';
            document.getElementById('scheduleDay').value = schedule.dayOfWeek || 'Monday';
            document.getElementById('scheduleTitle').value = schedule.subject || '';
            document.getElementById('scheduleInstructor').value = schedule.instructor || '';
            // Preselect canonical room and campus in edit modal. If legacy values exist, attempt normalization.
            const roomSelect = document.getElementById('scheduleRoom');
            const campusSelect = document.getElementById('scheduleCampus');
            const normalizedRoom = (function(v) {
              if (!v) return '';
              const map = { 'room 202': 'Laboratory 1 — Room 202', 'room202': 'Laboratory 1 — Room 202', 'rm 202': 'Laboratory 1 — Room 202', 'laboratory 1': 'Laboratory 1 — Room 202', 'lab 1': 'Laboratory 1 — Room 202', 'room 204': 'Laboratory 2 — Room 204', 'room204': 'Laboratory 2 — Room 204', 'rm 204': 'Laboratory 2 — Room 204', 'laboratory 2': 'Laboratory 2 — Room 204', 'lab 2': 'Laboratory 2 — Room 204' };
              const key = String(v).trim().toLowerCase();
              return map[key] || v || '';
            })(schedule.laboratoryRoom || '');
            const normalizedCampus = (function(v) { if (!v) return ''; const candidates = ['Bongabong','Calapan','Victoria']; const found = candidates.find(c=>c.toLowerCase()===String(v).trim().toLowerCase()); return found||v||''; })(schedule.campus || '');
            if (roomSelect) roomSelect.value = normalizedRoom || '';
            if (campusSelect) campusSelect.value = normalizedCampus || '';
            document.getElementById('scheduleStartTime').value = schedule.startTime || '';
            document.getElementById('scheduleEndTime').value = schedule.endTime || '';
            document.getElementById('scheduleQrEnabled').checked = Boolean(schedule.qrEnabled);
            resetClassListUploadState();
            const modal = document.getElementById('scheduleModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex', 'show');
            modal.style.display = 'flex';
            modal.style.opacity = '1';
          }

          let parsedClassListPayload = null;

          function resetClassListUploadState() {
            parsedClassListPayload = null;
            const message = document.getElementById('scheduleClassListMessage');
            const meta = document.getElementById('scheduleClassListMeta');
            const validation = document.getElementById('scheduleClassListValidation');
            const fileInput = document.getElementById('scheduleClassListFile');
            if (message) message.innerHTML = 'No class list selected.';
            if (meta) meta.innerHTML = '';
            if (validation) validation.classList.add('hidden');
            if (fileInput) fileInput.value = '';
          }

          function updateClassListUploadState({ message, meta, isSuccess, isError }) {
            const messageNode = document.getElementById('scheduleClassListMessage');
            const metaNode = document.getElementById('scheduleClassListMeta');
            const validation = document.getElementById('scheduleClassListValidation');
            if (messageNode) {
              messageNode.className = isSuccess ? 'text-emerald-300 font-semibold' : isError ? 'text-red-200 font-semibold' : 'text-slate-400';
              messageNode.textContent = message;
            }
            if (metaNode) {
              metaNode.innerHTML = meta || '';
            }
            if (validation) {
              validation.classList.toggle('hidden', !isError);
              if (!isError) {
                validation.textContent = 'Please upload the official class list before creating the laboratory schedule.';
              }
            }
          }

          window.closeScheduleModal = function closeScheduleModal() {
            const modal = document.getElementById('scheduleModal');
            if (!modal) return;
            modal.classList.remove('show');
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            modal.style.opacity = '0';
            const form = document.getElementById('scheduleForm');
            if (form) form.reset();
            editingScheduleId = null;
            resetClassListUploadState();
            try { document.body.classList.remove('overflow-hidden'); } catch (e) {}
          };
          window.handleClassListFileChange = handleClassListFileChange;
          window.handleScheduleSubmit = handleScheduleSubmit;

          function normalizeClassListRow(row) {
            if (!row || typeof row !== 'object') return null;
            const normalized = {};
            Object.entries(row).forEach(([key, value]) => {
              const normalizedKey = String(key).trim().toLowerCase();
              normalized[normalizedKey] = String(value ?? '').trim();
            });
            const studentId = normalized.studentid || normalized.student_id || normalized.studentnumber || normalized['student number'] || normalized['student no'] || normalized['student id'] || normalized.id || '';
            const fullName = normalized.fullname || normalized.name || normalized['full name'] || '';
            const courseSection = normalized.coursesection || normalized.course_section || normalized['course section'] || '';
            const program = normalized.program || '';
            const year = normalized.year || '';
            const section = normalized.section || '';
            const email = normalized.email || '';
            if (!studentId && !fullName) return null;
            return {
              studentId,
              fullName,
              courseSection,
              program,
              year,
              section,
              email
            };
          }

          function parseCsvToClassList(csv) {
            const lines = csv.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
            if (!lines.length) return [];
            const headerRow = lines[0].split(/,|\\t/).map((field) => field.trim().toLowerCase());
            const hasHeaders = ['studentid', 'fullname', 'coursesection', 'program', 'year', 'section', 'email'].every((key) => headerRow.includes(key));
            return lines.slice(hasHeaders ? 1 : 0).map((line) => {
              const values = line.split(/,|\\t/).map((cell) => cell.trim());
              return {
                studentId: values[headerRow.indexOf('studentid')] || values[0] || '',
                fullName: values[headerRow.indexOf('fullname')] || values[1] || '',
                courseSection: values[headerRow.indexOf('coursesection')] || values[2] || '',
                program: values[headerRow.indexOf('program')] || values[3] || '',
                year: values[headerRow.indexOf('year')] || values[4] || '',
                section: values[headerRow.indexOf('section')] || values[5] || '',
                email: values[headerRow.indexOf('email')] || values[6] || ''
              };
            }).filter((row) => row.studentId && row.fullName);
          }

          function parseExcelToClassList(workbook) {
            const sheetNames = workbook?.SheetNames || [];
            if (!sheetNames.length) return [];
            const sheet = workbook.Sheets[sheetNames[0]];
            const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            return rows.map(normalizeClassListRow).filter(Boolean);
          }

          function handleClassListFileChange(files) {
            const file = files?.[0];
            if (!file) {
              resetClassListUploadState();
              return;
            }
            const fileName = file.name || 'Selected file';
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const isExcel = ['xlsx', 'xls'].includes(extension);
            const isCsv = extension === 'csv';
            if (!isExcel && !isCsv) {
              parsedClassListPayload = null;
              updateClassListUploadState({
                message: 'Please upload a supported class list file (.xlsx, .xls, .csv).',
                meta: '',
                isError: true
              });
              return;
            }

            parsedClassListPayload = [];
            updateClassListUploadState({
              message: '✓ Class list file selected',
              meta: '<span class="font-semibold text-emerald-200">Ready to upload</span><span class="text-slate-400">• ' + fileName + '</span>',
              isSuccess: true
            });
          }

          async function handleScheduleSubmit(event) {
            event.preventDefault();
            const isEditing = Boolean(editingScheduleId);
            const day = document.getElementById('scheduleDay').value;
            const title = document.getElementById('scheduleTitle').value.trim();
            const instructor = document.getElementById('scheduleInstructor').value.trim();
            const room = document.getElementById('scheduleRoom').value.trim();
            const campus = String(window.__CURRENT_USER_CAMPUS__ || '').trim().replace(/\s*Campus\s*$/i, '');
            const statusElem = document.getElementById('scheduleStatus');
            const status = statusElem ? statusElem.value : 'Confirmed';
            const startTime = document.getElementById('scheduleStartTime').value.trim();
            const endTime = document.getElementById('scheduleEndTime').value.trim();
            const qrEnabled = document.getElementById('scheduleQrEnabled').checked;
            const classListValidation = document.getElementById('scheduleClassListValidation');
            const classListFileInput = document.getElementById('scheduleClassListFile');
            const hasClassListSelection = Boolean(classListFileInput?.files?.length || classListFileInput?.value);
            const classList = Array.isArray(parsedClassListPayload) ? parsedClassListPayload : [];

            if (!day || !title || !room || !campus || !startTime || !endTime) {
              alert('Please complete all required schedule fields.');
              return;
            }

            classListValidation?.classList.add('hidden');

            try {
              const formData = new FormData();
              formData.append('subject', title);
              formData.append('instructor', instructor);
              formData.append('laboratoryRoom', room);
              formData.append('campus', campus);
              formData.append('dayOfWeek', day);
              formData.append('startTime', startTime);
              formData.append('endTime', endTime);
              // Keep sending status if present to maintain backward compatibility; server uses default if omitted.
              if (status) formData.append('status', status);
              formData.append('qrEnabled', qrEnabled ? 'true' : 'false');
              if (classList.length) {
                formData.append('classList', JSON.stringify(classList));
              }
              if (classListFileInput?.files?.[0]) {
                formData.append('classListFile', classListFileInput.files[0]);
              }

              const response = await fetch(isEditing ? '/api/laboratory-schedules/' + encodeURIComponent(editingScheduleId) : '/api/laboratory-schedules', {
                method: isEditing ? 'PUT' : 'POST',
                credentials: 'same-origin',
                body: formData
              });

              if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Unable to save schedule');
              }

              const result = await response.json().catch(() => ({}));
              closeScheduleModal();
              await fetchSchedules();
              if (isEditing) {
                window.alert('Schedule updated successfully.');
              } else {
                window.alert('Schedule created successfully.');
              }

              if (qrEnabled && !isEditing) {
                const item = result.schedule || result;
                if (item?.id) {
                  const qrResponse = await createAttendanceSession({
                    id: item.id,
                    title: item.subject,
                    day: item.dayOfWeek,
                    time: item.startTime + ' - ' + item.endTime,
                    room: item.laboratoryRoom,
                    status: item.status
                  }, 15);
                  if (qrResponse?.session) {
                    await fetchSchedules();
                  }
                }
              }
            } catch (err) {
              console.error(err);
              alert((isEditing ? 'Failed to update schedule: ' : 'Failed to create schedule: ') + (err.message || 'Please try again.'));
            }
          }

          function openQrModal(scheduleOrId) {
            const modal = document.getElementById('qrModal');
            const schedule = normalizeScheduleRecord(typeof scheduleOrId === 'object' ? scheduleOrId : getScheduleById(scheduleOrId));
            const normalizedItem = normalizeScheduleForQr(schedule);
            if (!normalizedItem) return;
            activeQrScheduleIndex = scheduleData.findIndex((item) => String(item.id) === String(normalizedItem.id));
            if (activeQrScheduleIndex < 0) {
              activeQrScheduleIndex = typeof scheduleOrId === 'number' ? scheduleData.findIndex((item) => String(item.id) === String(scheduleOrId)) : null;
            }
            const subtitle = document.getElementById('qrModalSubtitle');
            subtitle.textContent = normalizedItem.subject + ' • ' + normalizedItem.dayOfWeek + ' • ' + normalizedItem.startTime + ' - ' + normalizedItem.endTime + ' • ' + normalizedItem.laboratoryRoom;
            modal.classList.add('show');
            modal.classList.remove('hidden');
            window.setTimeout(() => renderQrPreview(normalizedItem), 0);
          }

          function closeQrModal() {
            const modal = document.getElementById('qrModal');
            modal.classList.remove('show');
            modal.classList.add('hidden');
          }

          function renderQrPreview(item) {
            const preview = document.getElementById('qrPreview');
            const statusBadge = document.getElementById('qrStatusBadge');
            if (!item) return;
            preview.innerHTML = '';
            if (!item.qr || !item.qr.url) {
              preview.innerHTML = '<div class="text-center text-gray-400">No QR generated yet. Choose an expiration window and generate one.</div>';
              statusBadge.textContent = 'Not generated';
              statusBadge.className = 'rounded-full bg-slate-600/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200';
              return;
            }
            const wrapper = document.createElement('div');
            wrapper.className = 'flex flex-col items-center gap-3';
            const qrContainer = document.createElement('div');
            qrContainer.className = 'rounded-2xl bg-white p-5';
            qrContainer.style.width = '380px';
            qrContainer.style.maxWidth = '100%';
            qrContainer.style.display = 'flex';
            qrContainer.style.alignItems = 'center';
            qrContainer.style.justifyContent = 'center';
            qrContainer.style.padding = '24px';
            const qrInfo = document.createElement('div');
            qrInfo.className = 'text-center';
            qrInfo.innerHTML = '<p class="text-sm font-semibold text-white">' + (item.subject || item.title || 'Untitled Session') + '</p><p class="text-xs text-gray-400">' + (item.dayOfWeek || item.day || 'Monday') + ' • ' + (item.time || (item.startTime + ' - ' + item.endTime)) + '</p><p class="text-xs text-gray-500">' + (item.laboratoryRoom || item.room || 'No room') + '</p>';
            wrapper.appendChild(qrContainer);
            wrapper.appendChild(qrInfo);
            preview.appendChild(wrapper);

            const qrImage = document.createElement('img');
            qrImage.alt = 'Attendance QR';
            qrImage.src = item.qr.qrCode || item.qr.imageDataUrl || item.qr.url || '';
            qrImage.width = 320;
            qrImage.height = 320;
            qrImage.style.width = '320px';
            qrImage.style.height = '320px';
            qrImage.style.maxWidth = '100%';
            qrImage.style.objectFit = 'contain';
            qrImage.style.display = 'block';
            qrContainer.appendChild(qrImage);

            item.qr.imageDataUrl = item.qr.qrCode || item.qr.imageDataUrl || '';
            statusBadge.textContent = getQrStatus(item);
            statusBadge.className = 'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ' + getQrStatusClass(item);
          }

          async function generateCurrentQr() {
            const item = activeQrScheduleIndex !== null && activeQrScheduleIndex >= 0 ? normalizeScheduleRecord(scheduleData[activeQrScheduleIndex]) : null;
            if (!item) return;
            const minutes = parseInt(document.getElementById('qrExpirySelect').value, 10) || 15;
            const response = await createAttendanceSession(item, minutes);
            if (!response?.session) return;

            const qrData = response.session.qrCode || response.session.qrImage || '';
            const nextQr = {
              token: response.session.token,
              url: response.session.scanUrl,
              qrCode: qrData,
              expiresAt: new Date(response.session.expiresAt).getTime(),
              title: item.subject || item.title || 'Untitled Session',
              room: item.laboratoryRoom || item.room || 'No room',
              day: item.dayOfWeek || item.day || 'Monday',
              time: [item.startTime, item.endTime].filter(Boolean).join(' - '),
              imageDataUrl: qrData
            };

            item.qr = nextQr;
            if (activeQrScheduleIndex !== null && activeQrScheduleIndex >= 0) {
              scheduleData[activeQrScheduleIndex] = { ...scheduleData[activeQrScheduleIndex], qr: nextQr };
            }
            renderQrPreview(item);
            renderSchedules();
          }

          function regenerateCurrentQr() {
            generateCurrentQr();
          }

          function getCurrentQrDataUrl(item) {
            const preview = document.getElementById('qrPreview');
            const img = preview && preview.querySelector('img');
            if (img && img.currentSrc) return img.currentSrc;
            if (img && img.src) return img.src;
            if (!item || !item.qr) return null;
            const candidates = [item.qr.imageDataUrl, item.qr.qrCode, item.qr.url];
            for (const candidate of candidates) {
              if (typeof candidate === 'string' && candidate.trim()) {
                return candidate;
              }
            }
            return null;
          }

          function downloadCurrentQr() {
            const item = activeQrScheduleIndex !== null && activeQrScheduleIndex >= 0 ? normalizeScheduleRecord(scheduleData[activeQrScheduleIndex]) : null;
            const dataUrl = getCurrentQrDataUrl(item);
            if (!item || !dataUrl) {
              alert('No QR image is available yet. Generate a QR first.');
              return;
            }

            const link = document.createElement('a');
            link.download = 'attendance-qr-' + (item.subject || item.title || 'schedule').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }

          function printCurrentQr() {
            const item = activeQrScheduleIndex !== null && activeQrScheduleIndex >= 0 ? normalizeScheduleRecord(scheduleData[activeQrScheduleIndex]) : null;
            const dataUrl = getCurrentQrDataUrl(item);
            if (!item || !dataUrl) {
              alert('No QR image is available yet. Generate a QR first.');
              return;
            }

            const printWindow = window.open('', '_blank', 'width=800,height=900');
            if (!printWindow) {
              alert('Please allow pop-ups so the QR sticker can be printed.');
              return;
            }

            const title = String(item.subject || item.title || 'Untitled Session');
            const scheduleText = [item.dayOfWeek || item.day || 'Monday', [item.startTime, item.endTime].filter(Boolean).join(' - ') || item.time || ''].filter(Boolean).join(' • ');
            const roomText = item.laboratoryRoom || item.room || 'No room';
            const html = '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Attendance QR</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px;background:#fff;color:#111}h2{margin-bottom:8px}p{margin:4px 0}img{max-width:320px;margin-top:16px}</style></head><body><h2>' + title + '</h2><p>' + scheduleText + '</p><p>' + roomText + '</p><img src="' + dataUrl + '" /></body></html>';
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
            }, 350);
          }

          async function openAttendanceSessionModal(sessionId) {
            const modal = document.getElementById('attendanceSessionModal');
            const content = document.getElementById('attendanceSessionModalContent');
            const title = document.getElementById('attendanceSessionModalTitle');
            const subtitle = document.getElementById('attendanceSessionModalSubtitle');
            if (!modal || !content) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            title.textContent = 'Loading attendance details...';
            subtitle.textContent = 'Fetching the final attendance breakdown.';
            content.innerHTML = '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">Loading session details...</div>';

            try {
              const response = await fetch('/api/instructor/attendance-dashboard/' + encodeURIComponent(sessionId), { cache: 'no-store' });
              if (!response.ok) throw new Error('Unable to load attendance details');
              const payload = await response.json();
              const session = payload.session || {};
              const records = Array.isArray(payload.records) ? payload.records : [];
              const present = records.filter((row) => row.attendanceStatus === 'Present');
              const late = records.filter((row) => row.attendanceStatus === 'Late');
              const absent = records.filter((row) => row.attendanceStatus === 'Absent');
              const attendanceSessionState = {
                currentPage: 1,
                rowsPerPage: 3,
                filter: 'All',
                records: records,
                sessionKey: session.id || session.token || ''
              };
              const tabs = ['All', 'Present', 'Late', 'Absent'];
              const filter = 'All';

              title.textContent = session.subject || 'Attendance Details';
              subtitle.textContent = [session.laboratory || session.room, session.instructor].filter(Boolean).join(' • ');
              const metaRows = [
                '<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Subject</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + (session.subject || '—') + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Instructor</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + (session.instructor || '—') + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Laboratory</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + (session.laboratory || '—') + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Date</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + formatSessionDate(session.date || session.createdAt) + '</p>',
                '</div>',
                '</div>',
                '<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Start Time</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + (session.startTime || '—') + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">End Time</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + (session.endTime || '—') + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Total Students</p>',
                '<p class="mt-2 text-lg font-semibold text-white">' + records.length + '</p>',
                '</div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">',
                '<p class="text-sm text-slate-400">Status</p>',
                '<p class="mt-2 text-lg font-semibold text-white">Completed</p>',
                '</div>',
                '</div>',
                '<div class="grid gap-4 md:grid-cols-4">',
                '<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><p class="text-sm text-emerald-200">Present</p><p class="mt-2 text-2xl font-semibold text-white">' + present.length + '</p></div>',
                '<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><p class="text-sm text-amber-200">Late</p><p class="mt-2 text-2xl font-semibold text-white">' + late.length + '</p></div>',
                '<div class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4"><p class="text-sm text-red-200">Absent</p><p class="mt-2 text-2xl font-semibold text-white">' + absent.length + '</p></div>',
                '<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p class="text-sm text-slate-400">Attendance Window</p><p class="mt-2 text-lg font-semibold text-white">' + (session.startTime || '—') + ' - ' + (session.endTime || '—') + '</p></div>',
                '</div>',
                '<div class="flex flex-wrap gap-2 attendance-filter-container">' + tabs.map(function(tab) {
                  const activeClass = tab === filter ? 'bg-emerald-600 text-white' : 'bg-slate-900/70 text-slate-200';
                  return '<button type="button" data-tab="' + tab + '" class="attendance-filter-btn rounded-full border border-slate-700 px-3 py-2 text-sm font-semibold ' + activeClass + '">' + tab + '</button>';
                }).join('') + '</div>',
                '<div class="overflow-x-auto rounded-2xl border border-slate-800">',
                '<table class="min-w-full text-left divide-y divide-slate-800">',
                '<thead class="bg-slate-900/60">',
                '<tr>',
                '<th class="px-4 py-3 text-sm font-semibold text-slate-300">Student ID</th>',
                '<th class="px-4 py-3 text-sm font-semibold text-slate-300">Full Name</th>',
                '<th class="px-4 py-3 text-sm font-semibold text-slate-300">Status</th>',
                '<th class="px-4 py-3 text-sm font-semibold text-slate-300">Time In</th>',
                '</tr>',
                '</thead>',
                '<tbody id="attendanceSessionRows" class="divide-y divide-slate-800 text-sm text-slate-200"></tbody>',
                '</table>',
                '<div id="attendanceSessionPagination" class="mt-4 flex flex-wrap items-center gap-2"></div>',
                '</div>'
              ];
              content.innerHTML = metaRows.join('');
              // Attach click handlers to attendance filter buttons to avoid inline onclick generation
              try {
                const filterContainer = content.querySelector('.attendance-filter-container');
                if (filterContainer) {
                  const buttons = Array.from(filterContainer.querySelectorAll('button.attendance-filter-btn'));
                  buttons.forEach((btn) => {
                    btn.addEventListener('click', function () {
                      const tab = this.dataset.tab;
                      buttons.forEach((b) => {
                        b.classList.remove('bg-emerald-600', 'text-white');
                        b.classList.add('bg-slate-900/70', 'text-slate-200');
                      });
                      this.classList.remove('bg-slate-900/70', 'text-slate-200');
                      this.classList.add('bg-emerald-600', 'text-white');
                      try { window.renderAttendanceSessionRows(session.id || session.token || '', tab); } catch (e) { console.error(e); }
                    });
                  });
                }
              } catch (e) { console.error(e); }

              function renderAttendanceSessionPagination(filteredRows) {
                const paginationContainer = document.getElementById('attendanceSessionPagination');
                if (!paginationContainer) return;
                const totalPages = Math.max(1, Math.ceil(filteredRows.length / attendanceSessionState.rowsPerPage));
                attendanceSessionState.totalPages = totalPages;
                if (totalPages <= 1) {
                  paginationContainer.innerHTML = '';
                  return;
                }

                const activePage = Math.min(attendanceSessionState.currentPage, totalPages);
                attendanceSessionState.currentPage = activePage;

                const createPageButton = (page, label, isActive, isNavButton = false) => {
                  const button = document.createElement('button');
                  button.type = 'button';
                  button.textContent = label;
                  button.disabled = page === activePage && !isNavButton;
                  button.className = isNavButton
                    ? 'rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-900/50'
                    : (isActive
                      ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 font-bold text-white shadow-sm transition'
                      : 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 transition hover:bg-emerald-900/60');
                  if (button.disabled && !isNavButton) {
                    button.classList.add('cursor-not-allowed', 'opacity-40');
                  }
                  button.addEventListener('click', function () {
                    attendanceSessionState.currentPage = page;
                    window.renderAttendanceSessionRows(attendanceSessionState.sessionKey, attendanceSessionState.filter);
                  });
                  return button;
                };

                paginationContainer.innerHTML = '';
                const prevButton = createPageButton(Math.max(1, activePage - 1), 'Previous', false, true);
                prevButton.disabled = activePage <= 1;
                if (prevButton.disabled) prevButton.classList.add('cursor-not-allowed', 'opacity-40');
                paginationContainer.appendChild(prevButton);

                const visiblePages = getTruncatedPaginationItems(totalPages, activePage);
                visiblePages.forEach((pageItem) => {
                  if (pageItem === '...') {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'px-1 font-bold text-emerald-500/60';
                    ellipsis.textContent = '...';
                    paginationContainer.appendChild(ellipsis);
                    return;
                  }

                  paginationContainer.appendChild(createPageButton(pageItem, String(pageItem), pageItem === activePage));
                });

                const nextButton = createPageButton(Math.min(totalPages, activePage + 1), 'Next', false, true);
                nextButton.disabled = activePage >= totalPages;
                if (nextButton.disabled) nextButton.classList.add('cursor-not-allowed', 'opacity-40');
                paginationContainer.appendChild(nextButton);
              }

              window.renderAttendanceSessionRows = function(sessionKey, filterValue) {
                const rows = document.getElementById('attendanceSessionRows');
                if (!rows) return;
                const previousFilter = attendanceSessionState.filter;
                attendanceSessionState.filter = filterValue || 'All';
                if (attendanceSessionState.filter !== previousFilter) {
                  attendanceSessionState.currentPage = 1;
                }
                const filteredRows = attendanceSessionState.records.filter(function(row) {
                  return attendanceSessionState.filter === 'All' || row.attendanceStatus === attendanceSessionState.filter;
                });
                const startIndex = (attendanceSessionState.currentPage - 1) * attendanceSessionState.rowsPerPage;
                const pageItems = filteredRows.slice(startIndex, startIndex + attendanceSessionState.rowsPerPage);

                rows.innerHTML = pageItems.length ? pageItems.map(function(row) {
                  const status = row.attendanceStatus || row.status || 'Absent';
                  const statusClass = status === 'Late' ? 'bg-amber-500/10 text-amber-200' : status === 'Absent' ? 'bg-red-500/10 text-red-200' : 'bg-emerald-500/10 text-emerald-200';
                  const studentId = row.studentId || row.id || '—';
                  const name = row.studentName || row.fullName || '—';
                  const timeIn = row.timeIn || row.time || 'Not recorded';
                  return '<tr class="hover:bg-slate-900/70">' +
                    '<td class="px-4 py-3">' + studentId + '</td>' +
                    '<td class="px-4 py-3">' + name + '</td>' +
                    '<td class="px-4 py-3"><span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ' + statusClass + '">' + status + '</span></td>' +
                    '<td class="px-4 py-3">' + timeIn + '</td>' +
                    '</tr>';
                }).join('') : '<tr><td colspan="4" class="px-4 py-4 text-center text-slate-400">No students in this group.</td></tr>';

                renderAttendanceSessionPagination(filteredRows);
              };
              window.renderAttendanceSessionRows(sessionId, 'All');
            } catch (err) {
              console.error(err);
              content.innerHTML = '<div class="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">Unable to load the session details.</div>';
            }
          }

          function closeAttendanceSessionModal() {
            const modal = document.getElementById('attendanceSessionModal');
            if (modal) {
              modal.classList.add('hidden');
              modal.classList.remove('flex');
            }
          }

          document.addEventListener('DOMContentLoaded', async function() {
            console.log('[Add Schedule] DOMContentLoaded - binding Add Schedule button');
            const addScheduleButton = document.getElementById('openScheduleModalBtn');
            if (!addScheduleButton) console.warn('[Add Schedule] openScheduleModalBtn not found in DOM');
            // Also attach to any fallback Create Schedule button rendered inside the schedules grid
            const addScheduleFallback = document.getElementById('openScheduleModalFallback');
            if (addScheduleFallback) {
              addScheduleFallback.addEventListener('click', function (evt) {
                try {
                  if (typeof openScheduleModal === 'function') return openScheduleModal();
                  if (window.openScheduleModal && typeof window.openScheduleModal === 'function') return window.openScheduleModal();
                } catch (err) { console.error(err); }
                console.warn('[Add Schedule] openScheduleModal is not defined');
              });
            }
            renderSchedules();
            attachAttendanceFilters();
            await fetchAttendanceRecords();
            await fetchAttendanceStats();
            await fetchSchedules();
            startAttendanceRefresh();
          });
        </script>
      </section>
    `
  },
  "audit-logs": {
    title: "Audit Logs",
    description: "View system audit activity with filters, search, and details.",
    backRoute: "/admin-dashboard",
    backLabel: "Back to Admin Dashboard",
    content: String.raw`
      <style>
        body.app-shell .page-content {
          background:
            radial-gradient(circle at top left, rgba(34,197,94,0.08), transparent 32%),
            linear-gradient(180deg, rgba(4,14,10,0.98), rgba(2,9,6,0.98)) !important;
          border-radius: 24px;
          padding: 1rem;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
        }
        .page-hero-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.35rem 1.35rem 1.4rem;
          border-radius: 24px;
          border: 1px solid rgba(74,222,128,.16);
          background:
            radial-gradient(circle at top left, rgba(34,197,94,0.09), transparent 36%),
            linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          box-shadow: 0 12px 35px rgba(6,64,43,.18);
          backdrop-filter: blur(16px) saturate(1.04);
          margin-bottom: 1.5rem;
        }
        .page-title { font-size: 2rem; font-weight: 800; color: #f8fafc; margin: 0; }
        .audit-filters-shell {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          padding: 1rem;
          border-radius: 1.25rem;
          border: 1px solid rgba(74,222,128,.16);
          background: linear-gradient(180deg, rgba(12,28,20,.96), rgba(8,20,14,.95));
          box-shadow: 0 12px 32px rgba(6,64,43,.16);
        }
        .audit-filters-grid {
          display: grid;
          gap: 0.9rem;
          grid-template-columns: minmax(0, 2.2fr) minmax(180px, 1fr) minmax(160px, 1fr) minmax(140px, 140px) minmax(140px, 140px);
          align-items: center;
        }
        .audit-filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          min-width: 0;
        }
        .audit-filter-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(167,243,208,.8);
        }
        .audit-filter-field {
          width: 100%;
          border-radius: 0.95rem;
          border: 1px solid rgba(74,222,128,.16);
          background: rgba(8,20,14,.92);
          color: #e2e8f0;
          padding: 0.8rem 0.95rem;
          min-height: 2.95rem;
        }
        .audit-filter-field::placeholder { color: rgba(148,163,184,.72); }
        .audit-filter-field:focus {
          outline: none;
          border-color: rgba(74,222,128,.42);
          box-shadow: 0 0 0 3px rgba(16,185,129,.12);
        }
        .audit-filter-btn {
          width: 100%;
          min-height: 2.95rem;
          border-radius: 0.95rem;
          border: 1px solid transparent;
          cursor: pointer;
          padding: 0.78rem 1rem;
          font-weight: 700;
          transition: transform .16s ease, background-color .16s ease, border-color .16s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        .audit-filter-btn:hover { transform: translateY(-1px); }
        .audit-filter-btn-primary {
          background: linear-gradient(135deg, #16a34a, #22c55e);
          color: white;
        }
        .audit-filter-btn-secondary {
          background: rgba(15,23,42,.72);
          color: #e2e8f0;
          border-color: rgba(148,163,184,.2);
        }
        .audit-action-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 0.75rem;
        }
        .audit-action-buttons .audit-filter-btn {
          width: auto;
          min-width: 8.8rem;
          white-space: nowrap;
        }
        .audit-filters-grid .audit-filter-group:last-child .audit-filter-btn,
        .audit-filters-grid .audit-filter-group:nth-last-child(2) .audit-filter-btn {
          min-width: 8.8rem;
          width: 100%;
          flex: 0 0 auto;
        }
        .table-card { border: 1px solid rgba(74,222,128,.16); border-radius: 1.25rem; background: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96)); padding: 1.15rem; box-shadow: 0 12px 35px rgba(6,64,43,.18); }
        .action-pill { display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 999px; padding: 0.55rem 0.85rem; font-size: 0.8rem; font-weight: 700; }
        .pill-module { background: rgba(34,197,94,.12); color: #d9f8e7; }
        .pill-action { background: rgba(16,185,129,.12); color: #a7f3d0; }
        .detail-button { border: 1px solid rgba(74,222,128,.16); background: rgba(8,20,14,.92); color: #d8f5e0; border-radius: 0.9rem; padding: 0.65rem 0.95rem; cursor: pointer; }
        .detail-button:hover { background: rgba(16,31,24,.95); }
        .pagination-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          height: 2.2rem;
          padding: 0;
          border-radius: 999px;
          border: 1px solid rgba(74,222,128,.18);
          background: rgba(6,14,10,.72);
          color: #a7f3d0;
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .pagination-btn:hover:not(:disabled) {
          background: rgba(16,31,24,.95);
          color: #f8fafc;
        }
        .pagination-btn.active {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #f8fafc;
          border-color: rgba(16,185,129,.45);
          box-shadow: 0 8px 20px rgba(5,150,105,.28);
        }
        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }
        .pagination-nav {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.45rem;
          border-radius: 999px;
          background: rgba(6,14,10,.45);
          border: 1px solid rgba(74,222,128,.13);
        }
        .pagination-nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.45rem 0.8rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(74,222,128,.15);
          background: rgba(4,20,15,.65);
          color: #a7f3d0;
          font-size: 0.86rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .pagination-nav-btn:hover:not(:disabled) {
          background: rgba(16,31,24,.88);
          color: #f8fafc;
        }
        .pagination-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }
        .modal-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(2,9,6,.75); display: none; align-items: center; justify-content: center; padding: 1.5rem; }
        .modal-overlay.active { display: flex; }
        .modal-card { width: min(100%, 46rem); border-radius: 24px; background: rgba(7,21,17,.96); border: 1px solid rgba(74,222,128,.18); box-shadow: 0 24px 60px rgba(4,18,12,.48); padding: 1.5rem; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
        .modal-header h3 { margin: 0; color: #f8fafc; font-size: 1.35rem; }
        .modal-close { background: rgba(15,23,42,.8); color: #d8f5e0; border: none; border-radius: 0.95rem; padding: 0.75rem 1rem; cursor: pointer; }
        .modal-close:hover { background: rgba(15,23,42,.95); }
        .modal-body { display: grid; gap: 0.85rem; }
        .modal-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.95rem 1rem; border-radius: 1rem; background: rgba(10,25,18,.8); border: 1px solid rgba(74,222,128,.12); }
        .modal-label { color: rgba(148,163,184,.8); font-size: 0.9rem; }
        .modal-value { color: #f8fafc; font-size: 0.95rem; text-align: right; }
        @media (max-width: 980px) {
          .audit-filters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .audit-action-buttons { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .audit-filters-grid { grid-template-columns: 1fr; }
          .audit-action-buttons { flex-direction: column; }
          .audit-action-buttons .audit-filter-btn { width: 100%; }
        }
      </style>

      <section class="page-hero-card" style="justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">System Activity</h2>
        </div>
        <div class="ml-auto flex items-center gap-2 rounded-full border border-emerald-800/60 bg-[#06100b] px-3 py-2 shadow-[0_0_20px_rgba(34,197,94,0.12)]">
          <div class="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[0.8rem] font-semibold text-emerald-200" id="adminBadgeAvatar">AD</div>
          <div class="min-w-0">
            <div class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-200" id="adminBadgeRole">Admin</div>
            <div class="text-sm font-semibold text-white" id="adminBadgeName">Administrator</div>
          </div>
        </div>
      </section>

      <section class="table-card mb-6">
        <div class="audit-filters-shell mb-4">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 w-full mb-4">
            <div class="audit-filter-group min-w-[200px]">
              <label class="audit-filter-label font-bold text-xs uppercase text-emerald-300/80 mb-1 block" for="auditSearchInput">Search</label>
              <input id="auditSearchInput" type="search" placeholder="Search audit logs..." class="audit-filter-field h-10" />
            </div>
            <div class="audit-filter-group min-w-[160px]">
              <label class="audit-filter-label font-bold text-xs uppercase text-emerald-300/80 mb-1 block" for="auditUserSelect">User</label>
              <select id="auditUserSelect" class="audit-filter-field h-10">
                <option value="">All Users</option>
              </select>
            </div>
            <div class="audit-filter-group min-w-[160px]">
              <label class="audit-filter-label font-bold text-xs uppercase text-emerald-300/80 mb-1 block" for="auditDateRangeSelect">Date Range</label>
              <select id="auditDateRangeSelect" class="audit-filter-field h-10">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div class="audit-filter-group min-w-[160px]">
              <label class="audit-filter-label font-bold text-xs uppercase text-emerald-300/80 mb-1 block" for="auditCampusDisplay">Campus</label>
              <div id="auditCampusDisplay" class="audit-filter-field h-10 flex items-center" aria-readonly="true"></div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 w-full mt-2">
            <button id="applyAuditFiltersBtn" type="button" class="h-10 px-5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg inline-flex items-center justify-center gap-2 transition min-w-[120px]">Filter</button>
            <button id="exportAuditLogsBtn" type="button" class="h-10 px-5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg inline-flex items-center justify-center gap-2 transition min-w-[130px]" onclick="window.exportAuditLogs && window.exportAuditLogs('pdf')">
              <i class="fas fa-file-pdf"></i> Export PDF
            </button>
            <button id="printAuditLogs" type="button" class="h-10 px-5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg inline-flex items-center justify-center gap-2 transition min-w-[100px]" onclick="window.exportAuditLogs && window.exportAuditLogs('print')">
              <i class="fas fa-print"></i> Print
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left divide-y divide-slate-700">
            <thead class="bg-slate-950 border-b border-slate-800">
              <tr>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Actor</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Role</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Action</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Module</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Description</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-300">Date / Time</th>
              </tr>
            </thead>
            <tbody id="auditLogsTableBody" class="divide-y divide-slate-800 text-sm text-slate-200">
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">Loading audit logs...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex w-full items-center justify-between gap-3">
          <div id="auditLogsSummary" class="text-slate-400 text-sm">Showing 0 audit entries.</div>
          <div class="flex items-center gap-2">
            <button id="auditPrevPage" class="pagination-nav-btn" type="button">Previous</button>
            <div class="pagination-nav" id="auditPageButtons"></div>
            <button id="auditNextPage" class="pagination-nav-btn" type="button">Next</button>
          </div>
        </div>
      </section>

      <script>
        const hydrateAdminBadge = () => {
          const sourceName = window.__CURRENT_USER_NAME__ || window.__CURRENT_USER__?.name || 'Administrator';
          const displayName = String(sourceName || 'Administrator').trim() || 'Administrator';
          const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AD';

          const avatarEl = document.getElementById('adminBadgeAvatar');
          const nameEl = document.getElementById('adminBadgeName');
          const roleEl = document.getElementById('adminBadgeRole');

          if (avatarEl) avatarEl.textContent = initials;
          if (nameEl) nameEl.textContent = displayName;
          if (roleEl) roleEl.textContent = 'Admin';
        };

        const hydrateAuditCampus = () => {
          const campus = String(window.__CURRENT_USER_CAMPUS__ || '').trim();
          const display = campus && /\bcampus$/i.test(campus) ? campus : (campus ? campus + ' Campus' : 'Campus unavailable');
          const campusDisplay = document.getElementById('auditCampusDisplay');
          if (campusDisplay) campusDisplay.textContent = display;
          auditState.campus = campus;
        };

        const auditState = { page: 1, pageSize: 5, totalPages: 1, query: '', userId: '', campus: window.__CURRENT_USER_CAMPUS__ || '', dateRange: 'all', dateFrom: '', dateTo: '', entries: [], users: [], isLoading: false, loadError: false };

        // Helper function to get elements with null checking
        const getAuditElements = () => ({
          auditSearchInput: document.getElementById('auditSearchInput'),
          auditUserSelect: document.getElementById('auditUserSelect'),
          auditCampusDisplay: document.getElementById('auditCampusDisplay'),
          auditDateRangeSelect: document.getElementById('auditDateRangeSelect'),
          applyAuditFiltersBtn: document.getElementById('applyAuditFiltersBtn'),
          auditLogsTableBody: document.getElementById('auditLogsTableBody'),
          auditLogsSummary: document.getElementById('auditLogsSummary'),
          auditPageButtons: document.getElementById('auditPageButtons'),
          auditPrevPage: document.getElementById('auditPrevPage'),
          auditNextPage: document.getElementById('auditNextPage')
        });

        let auditElements = getAuditElements();
        
        // Destructure for convenience, but will re-check if needed
        let auditSearchInput = auditElements.auditSearchInput;
        let auditUserSelect = auditElements.auditUserSelect;
        let auditCampusDisplay = auditElements.auditCampusDisplay;
        let auditDateRangeSelect = auditElements.auditDateRangeSelect;
        let applyAuditFiltersBtn = auditElements.applyAuditFiltersBtn;
        let auditLogsTableBody = auditElements.auditLogsTableBody;
        let auditLogsSummary = auditElements.auditLogsSummary;
        let auditPageButtons = auditElements.auditPageButtons;
        let auditPrevPage = auditElements.auditPrevPage;
        let auditNextPage = auditElements.auditNextPage;
        
        const ensureAuditElements = () => {
          auditElements = getAuditElements();
          auditSearchInput = auditElements.auditSearchInput;
          auditUserSelect = auditElements.auditUserSelect;
          auditCampusDisplay = auditElements.auditCampusDisplay;
          auditDateRangeSelect = auditElements.auditDateRangeSelect;
          applyAuditFiltersBtn = auditElements.applyAuditFiltersBtn;
          auditLogsTableBody = auditElements.auditLogsTableBody;
          auditLogsSummary = auditElements.auditLogsSummary;
          auditPageButtons = auditElements.auditPageButtons;
          auditPrevPage = auditElements.auditPrevPage;
          auditNextPage = auditElements.auditNextPage;
          return auditElements;
        };

        const formatDateTime = (value) => {
          if (!value) return '—';
          try { return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
        };

        const formatAuditDescription = (entry) => {
          const description = String(entry.description || '').trim();
          if (!description) return '—';

          const attendanceCreated = /^Created attendance session .* for schedule \d+/i;
          const attendanceUpdated = /^Updated attendance for .* in session .*$/i;
          const attendanceRecorded = /^Recorded attendance for .* in session .*$/i;
          const maintenanceCreated = /^Maintenance request created for equipment .*$/i;
          const maintenanceStatus = /^Maintenance request .* status changed to (.+)\.?$/i;
          const maintenanceAssigned = /^Technician .* assigned to maintenance request .*$/i;
          const maintenanceDeleted = /^Maintenance request .* was deleted\.?$/i;
          const equipmentAdded = /^Equipment .* \((.+)\) was added\.$/i;
          const equipmentUpdated = /^Equipment .* \((.+)\) was updated\.$/i;
          const equipmentDeleted = /^Equipment .* \((.+)\) was deleted\.$/i;
          const borrowRecorded = /^.+ borrowed \d+x .+ \(.+\)\.$/i;
          const userProfileUpdated = /^User profile updated for .*\.?$/i;
          const userLoggedOut = /^User .* logged out\.?$/i;
          const scheduleCreated = /^Created laboratory schedule (.+?)(?: \(.+\))?\.?$/i;
          const scheduleUpdated = /^Updated laboratory schedule (.+?)(?: \(.+\))?\.?$/i;
          const scheduleDeleted = /^Deleted laboratory schedule (.+?)(?: \(.+\))?\.?$/i;

          if (attendanceCreated.test(description)) {
            return 'Created an attendance session for the selected laboratory schedule.';
          }
          if (attendanceUpdated.test(description)) {
            return 'Updated attendance details for the selected student.';
          }
          if (attendanceRecorded.test(description)) {
            return 'Recorded attendance for the selected student.';
          }
          if (maintenanceCreated.test(description)) {
            return 'Created a maintenance request for the selected equipment.';
          }
          if (maintenanceStatus.test(description)) {
            const match = description.match(maintenanceStatus);
            return match ? 'Updated maintenance request status to ' + match[1] + '.' : 'Updated maintenance request status.';
          }
          if (maintenanceAssigned.test(description)) {
            return 'Assigned a technician to a maintenance request.';
          }
          if (maintenanceDeleted.test(description)) {
            return 'Deleted a maintenance request.';
          }
          if (equipmentAdded.test(description)) {
            const match = description.match(equipmentAdded);
            return match ? 'Added equipment item ' + match[1] + '.' : 'Added a new equipment item.';
          }
          if (equipmentUpdated.test(description)) {
            const match = description.match(equipmentUpdated);
            return match ? 'Updated equipment item ' + match[1] + '.' : 'Updated an equipment item.';
          }
          if (equipmentDeleted.test(description)) {
            const match = description.match(equipmentDeleted);
            return match ? 'Deleted equipment item ' + match[1] + '.' : 'Deleted an equipment item.';
          }
          if (borrowRecorded.test(description)) {
            return description.replace(/ \([^)]*\)\.?$/, '.');
          }
          if (userProfileUpdated.test(description)) {
            return 'Updated the user profile.';
          }
          if (userLoggedOut.test(description)) {
            return 'User logged out.';
          }
          if (scheduleCreated.test(description)) {
            const match = description.match(scheduleCreated);
            return match ? 'Created laboratory schedule ' + match[1].trim() + '.' : 'Created a laboratory schedule.';
          }
          if (scheduleUpdated.test(description)) {
            const match = description.match(scheduleUpdated);
            return match ? 'Updated laboratory schedule ' + match[1].trim() + '.' : 'Updated a laboratory schedule.';
          }
          if (scheduleDeleted.test(description)) {
            const match = description.match(scheduleDeleted);
            return match ? 'Deleted laboratory schedule ' + match[1].trim() + '.' : 'Deleted a laboratory schedule.';
          }

          return description;
        };

        const getSlidingPageWindow = (totalPages, currentPage) => {
          if (totalPages <= 1) return [];
          if (totalPages <= 3) return Array.from({ length: totalPages }, (_, index) => index + 1);
          if (currentPage <= 1) return [1, 2, 3];
          if (currentPage >= totalPages) return [totalPages - 2, totalPages - 1, totalPages];
          return [currentPage - 1, currentPage, currentPage + 1];
        };

        const renderAuditPagination = () => {
          ensureAuditElements();
          
          if (!auditPageButtons) {
            console.warn('[Audit Logs] auditPageButtons not found');
            return;
          }
          
          const totalPages = Math.max(1, Number(auditState.totalPages) || 1);
          const currentPage = Math.min(Math.max(1, Number(auditState.page) || 1), totalPages);
          auditState.page = currentPage;

          auditPageButtons.innerHTML = '';
          if (totalPages <= 1) return;

          const visiblePages = getSlidingPageWindow(totalPages, currentPage);

          visiblePages.forEach((pageNum) => {
            const button = document.createElement('button');
            button.type = 'button';
            const isActive = pageNum === currentPage;
            button.className = isActive
              ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 font-bold text-white shadow-sm transition'
              : 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 transition hover:bg-emerald-900/60';
            button.textContent = String(pageNum);
            button.setAttribute('aria-label', 'Go to page ' + pageNum);
            button.setAttribute('aria-current', isActive ? 'page' : 'false');
            button.disabled = false;
            button.addEventListener('click', () => {
              console.log('[Audit Logs] Page', pageNum, 'clicked');
              if (auditState.page === pageNum) return;
              auditState.page = pageNum;
              loadAuditLogs();
            });
            auditPageButtons.appendChild(button);
          });
        };

        const renderAuditTable = () => {
          ensureAuditElements();
          
          if (!auditLogsTableBody) {
            console.warn('[Audit Logs] auditLogsTableBody not found');
            return;
          }
          
          const hasEntries = Array.isArray(auditState.entries) && auditState.entries.length > 0;

          if (auditState.isLoading) {
            console.log('[Audit Logs] Rendering loading state...');
            auditLogsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">Loading audit logs...</td></tr>';
            if (auditLogsSummary) auditLogsSummary.textContent = 'Loading audit entries...';
            if (auditPrevPage) auditPrevPage.disabled = true;
            if (auditNextPage) auditNextPage.disabled = true;
            if (auditPageButtons) auditPageButtons.innerHTML = '';
            return;
          }

          if (!hasEntries) {
            console.log('[Audit Logs] Rendering empty state, error:', auditState.loadError);
            const emptyMessage = auditState.loadError ? 'Unable to load audit logs.' : 'No audit entries found.';
            auditLogsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">' + emptyMessage + '</td></tr>';
            if (auditLogsSummary) auditLogsSummary.textContent = emptyMessage;
            if (auditPrevPage) auditPrevPage.disabled = true;
            if (auditNextPage) auditNextPage.disabled = true;
            if (auditPageButtons) auditPageButtons.innerHTML = '';
            return;
          }

          console.log('[Audit Logs] Rendering', auditState.entries.length, 'entries');
          
          const rows = auditState.entries.map((entry) => {
            return ''
              + '<tr class="hover:bg-slate-900/70">'
              + '<td class="px-4 py-4">' + (entry.actorName || 'System') + '</td>'
              + '<td class="px-4 py-4">' + (entry.actorRole || 'N/A') + '</td>'
              + '<td class="px-4 py-4"><span class="action-pill pill-action">' + entry.action + '</span></td>'
              + '<td class="px-4 py-4"><span class="action-pill pill-module">' + entry.module + '</span></td>'
              + '<td class="px-4 py-4">' + formatAuditDescription(entry) + '</td>'
              + '<td class="px-4 py-4">' + formatDateTime(entry.createdAt) + '</td>'
              + '</tr>';
          }).join('');
          
          auditLogsTableBody.innerHTML = rows;
          
          const summary = 'Showing ' + auditState.entries.length + ' entries on page ' + auditState.page + ' of ' + auditState.totalPages + '.';
          if (auditLogsSummary) auditLogsSummary.textContent = summary;
          console.log('[Audit Logs]', summary);
          
          if (auditPrevPage) auditPrevPage.disabled = auditState.page <= 1;
          if (auditNextPage) auditNextPage.disabled = auditState.page >= auditState.totalPages;
          renderAuditPagination();
        };

        const getAuditDateRangeBounds = (range = 'all') => {
          if (!range || range === 'all') return { dateFrom: '', dateTo: '' };

          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const formatDateValue = (value) => {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
          };

          if (range === 'today') {
            return { dateFrom: formatDateValue(today), dateTo: formatDateValue(today) };
          }

          if (range === 'week') {
            const firstDay = new Date(today);
            const day = today.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            firstDay.setDate(today.getDate() + diff);
            const lastDay = new Date(firstDay);
            lastDay.setDate(firstDay.getDate() + 6);
            return { dateFrom: formatDateValue(firstDay), dateTo: formatDateValue(lastDay) };
          }

          if (range === 'month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { dateFrom: formatDateValue(firstDay), dateTo: formatDateValue(lastDay) };
          }

          if (range === 'year') {
            const firstDay = new Date(today.getFullYear(), 0, 1);
            const lastDay = new Date(today.getFullYear(), 11, 31);
            return { dateFrom: formatDateValue(firstDay), dateTo: formatDateValue(lastDay) };
          }

          return { dateFrom: '', dateTo: '' };
        };

        const getAuditDateRangeLabel = (range = auditState.dateRange) => {
          switch (range) {
            case 'today': return 'Today';
            case 'week': return 'This Week';
            case 'month': return 'This Month';
            case 'year': return 'This Year';
            default: return 'All Time';
          }
        };

        const buildAuditQuery = () => {
          const params = new URLSearchParams();
          const devBypass = new URLSearchParams(window.location.search).get('devBypass');
          if (auditState.query) params.set('q', auditState.query);
          if (auditState.userId) params.set('userId', auditState.userId);
          if (auditState.campus) params.set('campus', auditState.campus);
          if (auditState.dateFrom) params.set('dateFrom', auditState.dateFrom);
          if (auditState.dateTo) params.set('dateTo', auditState.dateTo);
          if (devBypass === '1' || devBypass === 'true') params.set('devBypass', '1');
          params.set('page', Number(auditState.page) || 1);
          params.set('pageSize', Number(auditState.pageSize) || 5);
          return params.toString();
        };

        const loadAuditLogs = async () => {
          ensureAuditElements();
          
          auditState.isLoading = true;
          auditState.loadError = false;
          renderAuditTable();
          console.log('[Audit Logs] Started loading, isLoading=true, renderAuditTable called');

          try {
            const url = '/api/audit-logs?' + buildAuditQuery();
            console.log('[Audit Logs] Fetching from URL:', url);
            
            const response = await fetch(url, {
              cache: 'no-store',
              headers: { 'Accept': 'application/json' }
            });
            
            console.log('[Audit Logs] Response received, status:', response.status);
            
            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();
            let payload = null;

            if (text) {
              try {
                payload = contentType.includes('application/json') ? JSON.parse(text) : null;
              } catch (parseErr) {
                console.warn('[Audit Logs] JSON parse error:', parseErr);
                payload = null;
              }
            }

            if (!response.ok) {
              const message = payload && payload.error ? payload.error : 'Failed to load audit logs';
              console.error('[Audit Logs] API error response:', message);
              throw new Error(message);
            }

            if (!payload || typeof payload !== 'object') {
              console.error('[Audit Logs] Invalid response payload:', payload);
              throw new Error('Invalid audit logs response');
            }

            auditState.entries = Array.isArray(payload.data) ? payload.data : [];
            auditState.totalPages = payload.meta ? payload.meta.totalPages : 1;
            auditState.total = payload.meta ? payload.meta.total : auditState.entries.length;
            auditState.loadError = false;
            
            console.log('[Audit Logs] Data loaded successfully:', {
              entriesCount: auditState.entries.length,
              totalPages: auditState.totalPages,
              total: auditState.total
            });
          } catch (error) {
            console.error('[Audit Logs] Load failed:', error);
            auditState.entries = [];
            auditState.totalPages = 1;
            auditState.total = 0;
            auditState.loadError = true;
          } finally {
            auditState.isLoading = false;
            renderAuditTable();
            console.log('[Audit Logs] Finished loading, isLoading=false, renderAuditTable called');
          }
        };

        const loadAuditUsers = async () => {
          console.log('[Audit Logs] Loading audit users...');
          try {
            const response = await fetch('/api/users?auditScope=1', { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to load users');
            const users = await response.json();
            auditState.users = Array.isArray(users) ? users.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' })) : [];
            console.log('[Audit Logs] Users loaded:', auditState.users.length);
            
            ensureAuditElements();
            
            if (!auditUserSelect) {
              console.warn('[Audit Logs] auditUserSelect not found');
              return;
            }
            
            auditUserSelect.innerHTML = '<option value="">All Users</option>' + auditState.users.map((user) => {
              const name = String(user.name || user.email || 'User ' + user.id).trim();
              const campus = user.campus ? ' (' + user.campus + ')' : '';
              const label = name + campus;
              return '<option value="' + String(user.id) + '">' + label + '</option>';
            }).join('');
            console.log('[Audit Logs] User dropdown populated with', auditState.users.length, 'users');

            if (auditState.userId) {
              auditUserSelect.value = auditState.userId;
            }
          } catch (error) {
            console.error('[Audit Logs] Failed to load audit users:', error);
          }
        };

        const applyAuditFilters = () => {
          updateAuditFilters();
        };

        window.applyAuditFilters = applyAuditFilters;

        const resetAuditFilters = () => {
          console.log('[Audit Logs] resetAuditFilters called');
          ensureAuditElements();
          
          if (auditSearchInput) auditSearchInput.value = '';
          if (auditUserSelect) auditUserSelect.value = '';
          if (auditDateRangeSelect) auditDateRangeSelect.value = 'all';
          auditState.page = 1;
          auditState.dateRange = 'all';
          auditState.dateFrom = '';
          auditState.dateTo = '';
          console.log('[Audit Logs] Filters cleared, calling updateAuditFilters');
          updateAuditFilters();
        };

        window.resetAuditFilters = resetAuditFilters;

        const updateAuditFilters = () => {
          console.log('[Audit Logs] updateAuditFilters called');
          ensureAuditElements();
          
          auditState.query = auditSearchInput?.value?.trim() || '';
          auditState.userId = auditUserSelect?.value || '';
          auditState.campus = window.__CURRENT_USER_CAMPUS__ || auditState.campus || '';
          auditState.dateRange = auditDateRangeSelect?.value || 'all';
          
          console.log('[Audit Logs] Current filter state:', {
            query: auditState.query,
            userId: auditState.userId,
            campus: auditState.campus,
            dateRange: auditState.dateRange
          });
          
          const bounds = getAuditDateRangeBounds(auditState.dateRange);
          auditState.dateFrom = bounds.dateFrom;
          auditState.dateTo = bounds.dateTo;
          auditState.page = 1;
          loadAuditLogs();
        };

        // Define event handlers outside so they can be removed/re-attached
        const auditEventHandlers = {};

        const createAuditEventHandlers = () => {
          auditEventHandlers.updateFilters = () => updateAuditFilters();
          auditEventHandlers.userChanged = () => {
            console.log('[Audit Logs] User select changed');
            ensureAuditElements();
            auditState.userId = auditUserSelect?.value || '';
            auditState.page = 1;
            loadAuditLogs();
          };
          auditEventHandlers.filterClicked = (e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            console.log('[Audit Logs] Filter button clicked');
            applyAuditFilters();
          };
        };

        createAuditEventHandlers();
        hydrateAuditCampus();

        const attachAuditEventListeners = () => {
          console.log('[Audit Logs] Attaching event listeners...');
          ensureAuditElements();
          
          // Search input - live search
          if (auditSearchInput) {
            auditSearchInput.addEventListener('input', auditEventHandlers.updateFilters);
            console.log('[Audit Logs] Search input listener attached');
          } else {
            console.warn('[Audit Logs] auditSearchInput not found');
          }
          
          // User select
          if (auditUserSelect) {
            auditUserSelect.addEventListener('change', auditEventHandlers.userChanged);
            console.log('[Audit Logs] User select listener attached');
          } else {
            console.warn('[Audit Logs] auditUserSelect not found');
          }
          
          // Date range select
          if (auditDateRangeSelect) {
            auditDateRangeSelect.addEventListener('change', auditEventHandlers.updateFilters);
            console.log('[Audit Logs] Date range select listener attached');
          } else {
            console.warn('[Audit Logs] auditDateRangeSelect not found');
          }
          
          // Filter button - main filter action
          if (applyAuditFiltersBtn) {
            applyAuditFiltersBtn.addEventListener('click', auditEventHandlers.filterClicked, false);
            console.log('[Audit Logs] Filter button listener attached');
          } else {
            console.warn('[Audit Logs] applyAuditFiltersBtn not found');
          }
        };
        // refreshAuditLogs button removed from UI; keep function available
        // If you need a programmatic refresh, call loadAuditLogs()
        const buildAuditHtml = (exportRows = auditState.entries) => {
          const headers = ['Actor','Role','Action','Module','Description','Date / Time'];
          const escapeHtml = (value) => {
            const text = String(value || '');
            return text
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;')
              .replaceAll('\n', '<br>');
          };
          const rows = (Array.isArray(exportRows) ? exportRows : []).map(e => headers.map(h => {
            switch(h) {
              case 'Actor': return e.actorName || 'System';
              case 'Role': return e.actorRole || 'N/A';
              case 'Action': return e.action || '';
              case 'Module': return e.module || '';
              case 'Description': return e.description || '';
              case 'Date / Time': return formatDateTime(e.createdAt);
              default: return '';
            }
          }));
          const preparedBy = window.__CURRENT_USER_NAME__ || 'Administrator';
          const filters = [];
          if (auditState.userId) {
            const selectedUser = auditState.users.find((user) => String(user.id) === String(auditState.userId));
            filters.push('User: ' + (selectedUser ? (selectedUser.name || selectedUser.email || auditState.userId) : auditState.userId));
          }
          if (auditState.campus) filters.push('Campus: ' + auditState.campus);
          if (auditState.dateRange && auditState.dateRange !== 'all') filters.push('Date: ' + getAuditDateRangeLabel(auditState.dateRange));
          if (auditState.query) filters.push('Search: ' + auditState.query);
          const appliedFilters = filters.length ? filters.join(' • ') : 'All Time';
          const html = '<!doctype html><html><head><meta charset="utf-8"><title>Audit Logs</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a;background:#f8fafc}h2{margin-bottom:8px;color:#0f381e}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;text-align:left}th{background:#0f381e;color:#fff;font-weight:700}tr:nth-child(even){background:#f8fafc}td:nth-child(5){min-width:260px;white-space:normal}@media print{body{padding:12px}}</style></head><body><h2>System Audit Logs Report</h2><div>Prepared By: ' + preparedBy + ' • Generated: ' + (auditState.generatedAt || new Date().toLocaleString()) + '</div><div>Filters: ' + appliedFilters + '</div><table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></body></html>';
          return html;
        };

        const loadScript = (url) => new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.onload = () => resolve();
          s.onerror = (e) => reject(e);
          document.head.appendChild(s);
        });

        const fetchAuditExportRows = async () => {
          const params = new URLSearchParams();
          const devBypass = new URLSearchParams(window.location.search).get('devBypass');
          if (auditState.query) params.set('q', auditState.query);
          if (auditState.userId) params.set('userId', auditState.userId);
          if (auditState.campus) params.set('campus', auditState.campus);
          if (auditState.dateFrom) params.set('dateFrom', auditState.dateFrom);
          if (auditState.dateTo) params.set('dateTo', auditState.dateTo);
          if (devBypass === '1' || devBypass === 'true') params.set('devBypass', '1');
          params.set('page', '1');
          params.set('pageSize', '5000');
          params.set('exportAll', '1');

          const response = await fetch('/api/audit-logs?' + params.toString(), {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          });

          const contentType = response.headers.get('content-type') || '';
          const text = await response.text();
          let payload = null;

          if (text) {
            try {
              payload = contentType.includes('application/json') ? JSON.parse(text) : null;
            } catch {
              payload = null;
            }
          }

          if (!response.ok) {
            const message = payload && payload.error ? payload.error : 'Failed to fetch full audit export dataset';
            throw new Error(message);
          }

          const rows = Array.isArray(payload?.data) ? payload.data : [];
          return rows;
        };

        const exportAuditLogs = async (format) => {
          try {
            const exportRows = await fetchAuditExportRows();
            if (!exportRows || !exportRows.length) {
              alert('No audit entries to export.');
              return;
            }

            if (format === 'print') {
              const w = window.open('', '_blank');
              if (!w) {
                return alert('Unable to open print preview. Please allow popups for this site.');
              }
              w.document.write(buildAuditHtml(exportRows));
              w.document.close();
              w.focus();
              const tryPrint = () => {
                try {
                  w.print();
                } catch (err) {
                  console.warn('Print failed', err);
                }
              };
              if (w.document.readyState === 'complete') {
                tryPrint();
              } else {
                w.addEventListener('load', tryPrint);
              }
              return;
            }

            let pdfLib = window.jspdf && window.jspdf.jsPDF;
            if (!pdfLib) {
              try {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
              } catch (err) {
                console.warn('Failed to dynamically load jsPDF', err);
              }
              pdfLib = window.jspdf && window.jspdf.jsPDF;
              if (!pdfLib) {
                return alert('Failed to load PDF library (jsPDF). Please allow external scripts and try again.');
              }
            }

            const headers = ['Actor','Role','Action','Module','Description','Date / Time'];
            const rows = exportRows.map(e => ({
              Actor: e.actorName || 'System',
              Role: e.actorRole || 'N/A',
              Action: e.action || '',
              Module: e.module || '',
              Description: e.description || '',
              'Date / Time': formatDateTime(e.createdAt)
            }));

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 36;
            const contentWidth = pageWidth - margin * 2;
            const headerHeight = 18;
            const lineHeight = 12;
            const bodyPadding = 8;
            const colPercents = [0.12, 0.10, 0.12, 0.10, 0.36, 0.20];
            const colWidths = colPercents.map(percent => Math.max(70, Math.floor(contentWidth * percent)));
            const colX = [];
            let cursorX = margin;
            colWidths.forEach((width) => {
              colX.push(cursorX);
              cursorX += width;
            });
            const drawHeader = (startY) => {
              doc.setFillColor(15, 56, 30);
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.5);
              doc.rect(margin, startY, contentWidth, headerHeight, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(255, 255, 255);
              headers.forEach((header, index) => {
                const text = String(header).toUpperCase();
                const textWidth = doc.getTextWidth(text);
                const x = colX[index] + 8;
                const y = startY + 12;
                doc.text(text, x, y, { maxWidth: colWidths[index] - 12 });
                if (textWidth > colWidths[index] - 12) {
                  doc.text(text.slice(0, 18), x, y);
                }
              });
              return startY + headerHeight;
            };

            const drawWrappedCell = (text, x, y, width, height, options = {}) => {
              const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
              const wrapped = doc.splitTextToSize(cleanText, width - bodyPadding * 2);
              doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
              doc.setFontSize(options.fontSize || 8.5);
              doc.setTextColor(options.textColor || 20);
              const textHeight = wrapped.length * lineHeight;
              const safeHeight = Math.max(height, textHeight + bodyPadding * 2);
              const lines = wrapped.slice(0, 16);
              lines.forEach((line, lineIndex) => {
                doc.text(line, x + bodyPadding, y + bodyPadding + (lineIndex * lineHeight));
              });
              return safeHeight;
            };

            const preparedBy = window.__CURRENT_USER_NAME__ || 'Administrator';
            const generated = auditState.generatedAt || new Date().toLocaleString();
            const totalRecords = auditState.total || auditState.entries.length || 0;
            const filters = [];
            if (auditState.userId) {
              const selectedUser = auditState.users.find((user) => String(user.id) === String(auditState.userId));
              filters.push('User: ' + (selectedUser ? (selectedUser.name || selectedUser.email || auditState.userId) : auditState.userId));
            }
            filters.push('Date: ' + getAuditDateRangeLabel(auditState.dateRange));
            const filtersText = filters.length ? filters.join(' • ') : 'All Time';

            let y = margin;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(6, 78, 59);
            doc.text('MINDORO STATE UNIVERSITY', pageWidth / 2, y, { align: 'center' });
            y += 16;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            doc.text('College of Computer Studies', pageWidth / 2, y, { align: 'center' });
            y += 14;
            doc.text('Computer Laboratory Facilities Management System', pageWidth / 2, y, { align: 'center' });
            y += 20;
            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(1.2);
            doc.line(margin, y, pageWidth - margin, y);
            y += 12;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(6, 78, 59);
            doc.text('SYSTEM AUDIT LOGS REPORT', pageWidth / 2, y, { align: 'center' });
            y += 18;

            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(209, 250, 229);
            doc.setLineWidth(0.8);
            doc.rect(margin, y, contentWidth, 54, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(20, 20, 20);
            doc.text('Date Generated: ' + generated, margin + 10, y + 16);
            doc.text('Generated By: ' + preparedBy, margin + 10, y + 32);
            doc.text('Total Log Records: ' + String(totalRecords), margin + 10, y + 48);
            doc.text('Applied Filters: ' + filtersText, pageWidth / 2 + 10, y + 16, { maxWidth: contentWidth / 2 - 20 });
            y += 70;

            const startY = y;
            let currentY = drawHeader(startY);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);

            rows.forEach((row, rowIndex) => {
              const renderHeight = 22;
              const rowCells = headers.map((header) => {
                const value = row[header] || '';
                const text = String(value);
                return text;
              });

              const cellHeights = rowCells.map((value, index) => {
                const width = colWidths[index] - bodyPadding * 2;
                const wrapped = doc.splitTextToSize(String(value || ''), width);
                return Math.max(renderHeight, wrapped.length * lineHeight + bodyPadding * 2);
              });
              const currentRowHeight = Math.max(...cellHeights);

              if (currentY + currentRowHeight > pageHeight - 46) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 120);
                doc.text('Continued...', pageWidth - margin, pageHeight - 24, { align: 'right' });
                doc.addPage();
                currentY = margin + 20;
                currentY = drawHeader(currentY);
              }

              doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255);
              doc.rect(margin, currentY, contentWidth, currentRowHeight, 'F');
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.2);
              doc.setTextColor(20, 20, 20);
              rowCells.forEach((value, index) => {
                const width = colWidths[index] - bodyPadding * 2;
                const wrapped = doc.splitTextToSize(String(value || ''), width);
                const textY = currentY + bodyPadding + 2;
                const x = colX[index] + bodyPadding;
                if (headers[index] === 'Action' || headers[index] === 'Module') {
                  doc.setFillColor(220, 252, 231);
                  doc.setDrawColor(167, 243, 208);
                  doc.roundedRect(x - 2, textY - 4, Math.min(width + 4, doc.getTextWidth(String(value || '')) + 12), 14, 2, 2, 'FD');
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(21, 128, 61);
                  doc.text(String(value || ''), x, textY + 1, { maxWidth: width });
                } else {
                  doc.text(wrapped, x, textY);
                }
              });
              currentY += currentRowHeight;
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              const footerY = pageHeight - 24;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.setTextColor(120, 120, 120);
              doc.text('Generated by Computer Laboratory Facilities Management System', margin, footerY);
              doc.text('Page ' + i + ' of ' + pageCount, pageWidth - margin, footerY, { align: 'right' });
            }

            doc.save('system-audit-logs.pdf');
          } catch (error) {
            console.error('[Audit Logs] Export failed:', error);
            alert('Failed to export audit logs. Please try again.');
          }
        };

        const printBtn = document.getElementById('printAuditLogs');
        const exportBtn = document.getElementById('exportAuditLogsBtn');
        if (printBtn) printBtn.addEventListener('click', () => exportAuditLogs('print'));
        if (exportBtn) exportBtn.addEventListener('click', async () => { await exportAuditLogs('pdf'); });
        window.exportAuditLogs = exportAuditLogs;
        
        // Pagination listeners
        if (auditPrevPage) {
          auditPrevPage.addEventListener('click', () => {
            console.log('[Audit Logs] Previous page clicked, current page:', auditState.page);
            if (auditState.page > 1) {
              auditState.page -= 1;
              console.log('[Audit Logs] Moving to page:', auditState.page);
              loadAuditLogs();
            }
          });
        }
        
        if (auditNextPage) {
          auditNextPage.addEventListener('click', () => {
            console.log('[Audit Logs] Next page clicked, current page:', auditState.page, 'total pages:', auditState.totalPages);
            if (auditState.page < auditState.totalPages) {
              auditState.page += 1;
              console.log('[Audit Logs] Moving to page:', auditState.page);
              loadAuditLogs();
            }
          });
        }

        const initializeAuditPage = () => {
          console.log('[Audit Logs] Initializing audit page...');
          ensureAuditElements();
          
          hydrateAdminBadge();
          console.log('[Audit Logs] Admin badge hydrated');
          
          attachAuditEventListeners();
          console.log('[Audit Logs] Event listeners attached');
          
          loadAuditUsers();
          console.log('[Audit Logs] Loading audit users...');
          
          loadAuditLogs();
          console.log('[Audit Logs] Loading audit logs...');
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initializeAuditPage, { once: true });
        } else {
          initializeAuditPage();
        }
      </script>
    `
  },
  "reports": {
    title: "Reports",
    description: "",
    backRoute: "/admin-dashboard",
    backLabel: "Back to Admin Dashboard",
    content: String.raw`
      <style>
        :root {
          color-scheme: dark;
          --bg: #07150F;
          --bg-secondary: #0A1D15;
          --panel: linear-gradient(180deg, rgba(15,36,27,.96), rgba(10,29,21,.96));
          --panel-strong: linear-gradient(180deg, rgba(15,36,27,.98), rgba(10,29,21,.98));
          --panel-soft: rgba(74,222,128,.06);
          --border: rgba(74,222,128,.15);
          --text: #F8FAFC;
          --muted: #B6D7C8;
          --accent: #22C55E;
          --accent-strong: #16A34A;
          --accent-soft: rgba(74,222,128,.12);
          --shadow: 0 12px 35px rgba(6,64,43,.18);
        }

        body {
          background: radial-gradient(circle at top left, rgba(34,197,94,.16), transparent 24%),
                      radial-gradient(circle at bottom right, rgba(74,222,128,.10), transparent 26%),
                      linear-gradient(180deg, #07150F 0%, #0A1D15 100%);
          color: var(--text);
        }

        body.app-shell .page-content {
          background:
            radial-gradient(circle at top left, rgba(34,197,94,.16), transparent 24%),
            radial-gradient(circle at bottom right, rgba(74,222,128,.10), transparent 26%),
            linear-gradient(180deg, #07150F 0%, #0A1D15 100%) !important;
          border-radius: 24px;
          padding: 1rem;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
        }

        .panel-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 1.25rem;
          box-shadow: var(--shadow);
        }

        .report-select {
          background: rgba(6, 16, 12, 0.9);
          border: 1px solid rgba(74, 222, 128, 0.35);
          color: #f8fafc;
          border-radius: 0.9rem;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        }
        .report-select:focus {
          border-color: rgba(74,222,128,.45);
          box-shadow: 0 0 0 3px rgba(34,197,94,.15);
          outline: none;
        }
        .report-select option {
          background: rgba(6,16,11,.98);
          color: #f8fafc;
        }
        .page-hero-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.35rem 1.35rem 1.4rem;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: var(--panel);
          box-shadow: var(--shadow);
          backdrop-filter: blur(16px) saturate(1.04);
          margin-bottom: 1.5rem;
        }
        .report-card-surface {
          background: var(--panel);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .report-table-shell {
          background: linear-gradient(180deg, rgba(11,26,19,.98), rgba(8,20,14,.96));
          border: 1px solid var(--border);
        }
        .report-preview-table thead tr {
          background: #06100b;
        }
        .report-preview-table thead th {
          color: #6ee7b7;
          background: #06100b;
          border-bottom: 1px solid rgba(74,222,128,.16);
        }
        .report-preview-table tbody tr {
          background: rgba(8,20,14,.5);
        }
        .report-preview-table tbody tr:hover {
          background: rgba(34,197,94,.08);
        }
        .report-empty-state {
          background: linear-gradient(180deg, rgba(11,26,19,.98), rgba(8,20,14,.96));
          border: 1px solid var(--border);
          color: #d1fae5;
        }
        #summaryCards > div {
          background: var(--panel);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        #reportPagination button {
          border: 1px solid rgba(74,222,128,.18);
          background: #06100b;
          color: #d1fae5;
        }
        #reportPagination button:hover:not(:disabled) {
          background: rgba(34,197,94,.12);
          border-color: rgba(74,222,128,.3);
        }
        #reportPagination button.active {
          background: linear-gradient(135deg, #22C55E, #16A34A);
          color: #06100b;
          border-color: rgba(74,222,128,.2);
        }
        #generateReportButton {
          background: linear-gradient(135deg, #16A34A, #22C55E);
          color: #f0fdf4;
          border-radius: 999px;
          border: 1px solid rgba(74,222,128,.2);
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(6,64,43,.16);
        }
        #generateReportButton:hover:not(:disabled) {
          background: linear-gradient(135deg, #22C55E, #4ADE80);
        }
        button[onclick*="exportReport"] {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #e2e8f0;
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        }
        button[onclick*="exportReport"]:hover {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(148, 163, 184, 0.35);
        }
        .page-hero-meta {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .page-eyebrow {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(110, 231, 183, 0.72);
          margin: 0;
        }
        .page-title {
          font-size: 2rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .page-subtitle {
          color: #cbd5e1;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
          max-width: 44rem;
        }
        .page-hero-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 1rem;
          background: rgba(74,222,128,.14);
          color: #f8fafc;
          border: 1px solid rgba(74,222,128,.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
          flex-shrink: 0;
        }
        @media (max-width: 1023px) {
          .page-hero-card {
            gap: 0.75rem;
          }
        }
        @media (max-width: 480px) {
          .page-hero-card {
            flex-wrap: wrap;
          }
          .page-hero-card > .page-hero-meta {
            flex: 1 1 100%;
            min-width: 0;
            padding-left: 3.5rem;
          }
          .page-hero-card > .page-hero-student-badge {
            margin-left: 3.5rem;
          }
        }
      </style>
      <section class="page-hero-card panel-card" style="justify-content:space-between; align-items:center; padding:1.1rem 1.2rem;">
        <button id="mobileMenuToggle" type="button" onclick="toggleSidebar()" class="menu-toggle block lg:hidden" aria-label="Open navigation">
          <i class="fas fa-bars"></i>
        </button>
        <div class="page-hero-meta min-w-0 flex-1 pl-14 lg:pl-0">
          <h2 class="page-title">Reports</h2>
        </div>
        <div class="page-hero-student-badge ml-auto flex shrink-0 items-center gap-2 rounded-full border border-emerald-800/60 bg-[#06100b] px-3 py-2 shadow-[0_0_20px_rgba(34,197,94,0.12)]">
          <div class="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[0.8rem] font-semibold text-emerald-200" id="adminBadgeAvatar">AD</div>
          <div class="min-w-0">
            <div class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-200" id="adminBadgeRole">Admin</div>
            <div class="text-sm font-semibold text-white" id="adminBadgeName">Administrator</div>
          </div>
        </div>
      </section>

      <section class="card mb-6 report-card-surface panel-card" style="padding: 1rem;">
        <form id="reportFiltersForm" class="grid gap-4" onsubmit="handleGenerateReport(event)">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label class="block text-sm font-semibold text-emerald-100/80 mb-1.5">Report Type</label>
              <select id="reportTypeSelect" class="form-control report-select" onchange="handleReportTypeChange()">
                <option>Equipment Inventory</option>
                <option>Borrow Equipment</option>
                <option>Attendance</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-emerald-100/80 mb-1.5">Campus</label>
              <select id="campusFilter" class="form-control report-select" onchange="handleFilterChange('campus')">
                <option value="">All Campuses</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-emerald-100/80 mb-1.5">Report Period</label>
              <select id="reportPeriodFilter" class="form-control report-select" onchange="handleFilterChange()">
                <option value="all">All Records</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="semester">This Semester</option>
                <option value="school-year">This School Year</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-emerald-100/80 mb-1.5">Laboratory</label>
              <select id="laboratoryFilter" class="form-control report-select" onchange="handleFilterChange()">
                <option value="">All Laboratories</option>
              </select>
            </div>
            <div>
              <label id="statusFilterLabel" class="block text-sm font-semibold text-emerald-100/80 mb-1.5">Status</label>
              <select id="statusFilter" class="form-control report-select" onchange="handleFilterChange()">
                <option value="">All Statuses</option>
              </select>
            </div>
            <div class="flex flex-col gap-3 lg:row-span-2 lg:justify-end">
              <button id="generateReportButton" type="submit" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black shadow-[0_8px_18px_rgba(6,64,43,.16)] transition hover:bg-emerald-400">
                <svg id="generateReportSpinner" class="hidden h-4 w-4 animate-spin text-black" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span id="generateReportButtonText">Generate Report</span>
              </button>
              <button type="button" onclick="exportReport('pdf')" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-700/60 bg-[#06100b] px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-900/40">
                <i class="fas fa-file-pdf text-emerald-400"></i> Export PDF
              </button>
              <button type="button" onclick="exportReport('print')" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-700/60 bg-[#06100b] px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-900/40">
                <i class="fas fa-print text-emerald-400"></i> Print Report
              </button>
            </div>
          </div>
        </form>
      </section>

      <section class="card mb-6 report-card-surface panel-card" style="">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.35em] text-emerald-400/80"></p>
            <h3 id="previewReportTitle" class="mt-2 text-xl font-semibold text-white"></h3>
            <p id="reportCountText" class="mt-1 text-sm text-emerald-100/70"></p>
            <div id="generatedMeta" class="mt-2 flex flex-wrap gap-2 text-xs text-emerald-100/60">
              <span id="previewGeneratedAt"></span>
            </div>
          </div>
          <div class="rounded-3xl border border-emerald-700/60 bg-[#06100b] px-4 py-3 text-sm text-emerald-100/70">Only the currently generated dataset will export.</div>
        </div>

        <div id="summaryCards" class="panel-card mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>

        <div class="report-table-shell panel-card mt-5 overflow-x-auto rounded-3xl p-2">
          <table id="reportPreviewTable" class="report-preview-table min-w-full border-separate border-spacing-y-2 text-left text-sm text-emerald-50/90">
            <thead class="bg-[#06100b]">
              <tr id="reportTableHeader"></tr>
            </thead>
            <tbody id="reportTableBody" class="divide-y divide-slate-800"></tbody>
          </table>
        </div>
        <div id="reportPagination" class="mt-3 flex flex-wrap items-center justify-end gap-2"></div>

        <div id="reportEmptyState" class="report-empty-state mt-6 rounded-3xl px-5 py-8 text-center text-sm text-emerald-100/70">
          No records found for the selected filters.
        </div>
      </section>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.0/jspdf.plugin.autotable.min.js"></script>
      <script>
        const hydrateAdminBadge = () => {
          const sourceName = window.__CURRENT_USER_NAME__ || window.__CURRENT_USER__?.name || 'Administrator';
          const displayName = String(sourceName || 'Administrator').trim() || 'Administrator';
          const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AD';

          const avatarEl = document.getElementById('adminBadgeAvatar');
          const nameEl = document.getElementById('adminBadgeName');
          const roleEl = document.getElementById('adminBadgeRole');

          if (avatarEl) avatarEl.textContent = initials;
          if (nameEl) nameEl.textContent = displayName;
          if (roleEl) roleEl.textContent = 'Admin';
        };

        const reportState = {
          reportType: 'Equipment Inventory',
          filters: {
            campus: '',
            laboratory: '',
            status: '',
            reportPeriod: 'all'
          },
          campusFilterExplicitlySet: false,
          data: [],
          filteredData: [],
          isLoading: false,
          generatedAt: '',
          previewShown: false,
          page: 1,
          rowsPerPage: 6
        };

        const reportTypeOptions = [
          'Equipment Inventory',
          'Borrow Equipment',
          'Attendance'
        ];

        const campusOptions = ['Bongabong Campus', 'Victoria Campus', 'Calapan Campus'];
        const laboratoryOptions = ['Laboratory 1', 'Laboratory 2'];

        const statusOptionsByReport = {
          'Equipment Inventory': ['All Statuses', 'Serviceable', 'Unserviceable'],
          'Borrow Equipment': ['All Statuses', 'Borrowed', 'Returned', 'Overdue'],
          'Maintenance': ['All Statuses', 'Pending', 'In Progress', 'Resolved'],
          'Attendance': ['All Statuses', 'Present', 'Late', 'Absent'],
          'User Activity': ['All Activities', 'Login', 'Logout', 'Account Created', 'Account Updated']
        };

        const reportDefinitions = {
          'Equipment Inventory': {
            endpoint: '/api/reports',
            title: 'Equipment Inventory Report',
            columns: ['Equipment ID', 'Equipment Name', 'Laboratory', 'Campus', 'Status', 'Condition']
          },
          'Borrow Equipment': {
            endpoint: '/api/reports',
            title: 'Borrow Equipment Report',
            columns: ['Borrower', 'Borrower Type', 'Equipment', 'Quantity', 'Borrow Date', 'Return Date', 'Status']
          },
          'Maintenance': {
            endpoint: '/api/reports',
            title: 'Maintenance Report',
            columns: ['Equipment', 'Damage Description', 'Priority', 'Technician', 'Date Reported', 'Status']
          },
          'Attendance': {
            endpoint: '/api/reports',
            title: 'Attendance Report',
            columns: ['Student', 'Laboratory', 'Date', 'Time In', 'Time Out', 'Status']
          },
          'User Activity': {
            endpoint: '/api/reports',
            title: 'User Activity Report',
            columns: ['User', 'Role', 'Activity', 'Date', 'Time']
          }
        };

        const getReportPeriodLabel = (value) => {
          const labels = {
            all: 'All Records',
            today: 'Today',
            week: 'This Week',
            month: 'This Month',
            semester: 'This Semester',
            'school-year': 'This School Year'
          };
          return labels[value] || 'All Records';
        };

        const getCellValue = (record, key) => {
          switch (key) {
            case 'Equipment ID': return record.equipmentId || record.id || '—';
            case 'Equipment Name': return record.name || record.equipmentName || record.equipment && record.equipment.name || '—';
            case 'Laboratory': return record.laboratoryRoom || record.lab || record.laboratory_room || record.laboratory || '—';
            case 'Campus': return record.campus || '—';
            case 'Condition': return record.condition || record.status || '—';
            case 'Status': return record.status || record.role || '—';
            case 'Borrower': return record.borrowerName || record.name || record.fullName || '—';
            case 'Borrower Type': return record.borrowerType || '—';
            case 'Quantity': return record.quantity != null ? record.quantity : '—';
            case 'Borrow Date': return record.borrowDate || '—';
            case 'Return Date': return record.returnDate || record.expectedReturnDate || '—';
            case 'Equipment': return record.equipmentName || record.name || record.equipment && record.equipment.name || '—';
            case 'Damage Description': return record.damageDescription || record.issueTitle || record.description || '—';
            case 'Priority': return record.priority || 'Normal';
            case 'Technician': return record.technicianName || record.technician && record.technician.name || 'Unassigned';
            case 'Date Reported': return record.dateReported || record.date || record.createdAt || '—';
            case 'Student': return record.fullName || record.borrowerName || record.name || '—';
            case 'Time In': return record.timeIn || record.time || '—';
            case 'Time Out': return record.timeOut || '—';
            case 'Activity': return record.activity || '—';
            case 'User': return record.user || record.name || '—';
            case 'Role': return record.role || '—';
            case 'Date': return record.date || record.createdAt || '—';
            case 'Time': return record.time || record.timeIn || '—';
            default: return '—';
          }
        };

        const formatCell = (value) => {
          if (typeof value !== 'string') return value ?? '—';
          return value || '—';
        };

        const getReportSummary = (rows) => {
          if (!rows.length) return [];

          if (reportState.reportType === 'Equipment Inventory') {
            const serviceable = rows.filter((row) => String(row.status || row.condition || '').toLowerCase() === 'serviceable').length;
            const unserviceable = rows.filter((row) => String(row.status || row.condition || '').toLowerCase() === 'unserviceable').length;
            const lost = rows.filter((row) => String(row.status || '').toLowerCase() === 'lost').length;
            return [
              { label: 'Total Records', value: rows.length },
              { label: 'Serviceable', value: serviceable },
              { label: 'Unserviceable', value: unserviceable },
              { label: 'Lost', value: lost }
            ];
          }

          if (reportState.reportType === 'Borrow Equipment') {
            const borrowed = rows.filter((row) => String(row.status || '').toLowerCase().includes('borrowed')).length;
            const returned = rows.filter((row) => String(row.status || '').toLowerCase().includes('returned')).length;
            return [
              { label: 'Total Records', value: rows.length },
              { label: 'Borrowed', value: borrowed },
              { label: 'Returned', value: returned }
            ];
          }

          if (reportState.reportType === 'Maintenance') {
            const pending = rows.filter((row) => String(row.status || '').toLowerCase().includes('pending')).length;
            const inProgress = rows.filter((row) => String(row.status || '').toLowerCase().includes('progress')).length;
            const resolved = rows.filter((row) => String(row.status || '').toLowerCase().includes('resolved')).length;
            return [
              { label: 'Total Records', value: rows.length },
              { label: 'Pending', value: pending },
              { label: 'Resolved', value: resolved },
              { label: 'In Progress', value: inProgress }
            ];
          }

          if (reportState.reportType === 'Attendance') {
            const present = rows.filter((row) => String(row.status || '').toLowerCase().includes('present')).length;
            const absent = rows.filter((row) => String(row.status || '').toLowerCase().includes('absent')).length;
            const late = rows.filter((row) => String(row.status || '').toLowerCase().includes('late')).length;
            return [
              { label: 'Total Records', value: rows.length },
              { label: 'Present', value: present },
              { label: 'Absent', value: absent },
              { label: 'Late', value: late }
            ];
          }

          const created = rows.filter((row) => String(row.activity || '').toLowerCase().includes('created')).length;
          const updated = rows.filter((row) => String(row.activity || '').toLowerCase().includes('updated')).length;
          return [
            { label: 'Total Records', value: rows.length },
            { label: 'Created', value: created },
            { label: 'Updated', value: updated }
          ];
        };

        const renderReportStatus = () => {
          const statusText = document.getElementById('reportCountText');
          const generatedMeta = document.getElementById('previewGeneratedAt');
          if (!statusText) return;

          if (reportState.isLoading) {
            statusText.textContent = 'Generating report from the database...';
            if (generatedMeta) generatedMeta.textContent = '';
            return;
          }

          if (!reportState.previewShown) {
            statusText.textContent = '';
            if (generatedMeta) generatedMeta.textContent = '';
            return;
          }

          if (reportState.campusRestricted) {
            statusText.textContent = 'Campus access restricted for ' + (reportState.restrictedCampus || 'this campus') + '. Viewing total count only.';
            if (generatedMeta) generatedMeta.textContent = reportState.generatedAt ? 'Generated ' + reportState.generatedAt : '';
            return;
          }

          if (!reportState.filteredData.length) {
            statusText.textContent = 'No records found for the selected filters.';
            if (generatedMeta) generatedMeta.textContent = reportState.generatedAt ? 'Generated ' + reportState.generatedAt : '';
            return;
          }

          if (reportState.reportType === 'Equipment Inventory') {
            statusText.textContent = '';
          } else {
            const count = reportState.filteredData.length;
            statusText.textContent = count + ' record' + (count === 1 ? '' : 's') + ' found for ' + reportState.reportType + '.';
          }
          if (generatedMeta) generatedMeta.textContent = reportState.generatedAt ? 'Generated ' + reportState.generatedAt : '';
        };

        const setGenerateButtonState = (disabled) => {
          const button = document.getElementById('generateReportButton');
          const spinner = document.getElementById('generateReportSpinner');
          const buttonText = document.getElementById('generateReportButtonText');
          if (!button || !spinner || !buttonText) return;
          button.disabled = disabled;
          spinner.classList.toggle('hidden', !disabled);
          buttonText.textContent = disabled ? 'Generating...' : 'Generate Report';
          button.classList.toggle('opacity-60', disabled);
          button.classList.toggle('cursor-not-allowed', disabled);
        };

        const updateFilterOptions = () => {
          const reportTypeSelect = document.getElementById('reportTypeSelect');
          const campusSelect = document.getElementById('campusFilter');
          const labSelect = document.getElementById('laboratoryFilter');
          const statusSelect = document.getElementById('statusFilter');

          reportTypeSelect.innerHTML = reportTypeOptions.map(function(value) {
            return '<option value="' + value + '">' + value + '</option>';
          }).join('');
          reportTypeSelect.value = reportState.reportType;

          const currentUserCampus = getCurrentUserCampus();
          const currentUserRole = String(window.__CURRENT_USER__?.role || '').trim().toLowerCase().replace(/[_-]+/g, '');
          const canViewAllCampuses = ['superadmin', 'centraladmin', 'systemadmin'].includes(currentUserRole);
          const availableCampuses = ['All Campuses'].concat(campusOptions);
          campusSelect.innerHTML = availableCampuses.map(function(value) {
            return '<option value="' + value + '">' + value + '</option>';
          }).join('');
          campusSelect.disabled = false;

          labSelect.innerHTML = '<option value="">All Laboratories</option>' + laboratoryOptions.map(function(value) {
            return '<option value="' + value + '">' + value + '</option>';
          }).join('');

          const statusOptions = statusOptionsByReport[reportState.reportType] || ['All Statuses'];
          statusSelect.innerHTML = statusOptions.map(function(value, index) {
            return '<option value="' + (index === 0 ? '' : value) + '">' + value + '</option>';
          }).join('');

          campusSelect.value = reportState.filters.campus || (currentUserCampus && !canViewAllCampuses ? currentUserCampus + ' Campus' : 'All Campuses');
          labSelect.value = reportState.filters.laboratory;
          statusSelect.value = reportState.filters.status;
          reportTypeSelect.value = reportState.reportType;
        };

        const renderReportHeader = () => {
          const titleEl = document.getElementById('previewReportTitle');
          const definition = reportDefinitions[reportState.reportType];
          if (titleEl) titleEl.textContent = definition.title;
        };

        const setExportButtonsRestricted = (isRestricted) => {
          const exportButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
            const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
            return label === 'Export PDF' || label === 'Print Report';
          });

          exportButtons.forEach((button) => {
            button.disabled = isRestricted;
            button.setAttribute('aria-disabled', String(isRestricted));
            button.classList.toggle('opacity-50', isRestricted);
            button.classList.toggle('cursor-not-allowed', isRestricted);
            button.style.pointerEvents = isRestricted ? 'none' : '';
          });
        };

        const renderSummaryCards = () => {
          const container = document.getElementById('summaryCards');
          if (!container) return;

          const summarySource = reportState.campusRestricted ? reportState.data : reportState.filteredData;
          const summary = reportState.campusRestricted
            ? [{ label: 'Total Records', value: Number(reportState.campusTotal || 0) }]
            : getReportSummary(summarySource || []);
          if (!summary.length) {
            container.innerHTML = '';
            return;
          }
          container.innerHTML = summary.map(function(item) {
            return '<div class="rounded-3xl border border-emerald-800/60 bg-[#0b1a13]/90 p-3 shadow-[0_8px_18px_rgba(6,64,43,.14)]"><p class="text-xs uppercase tracking-[0.3em] text-emerald-100/70">' + item.label + '</p><p class="mt-1.5 text-2xl font-semibold text-white">' + item.value + '</p></div>';
          }).join('');
        };

        const renderReportTable = () => {
          const definition = reportDefinitions[reportState.reportType];
          const headerRow = document.getElementById('reportTableHeader');
          const body = document.getElementById('reportTableBody');
          const emptyState = document.getElementById('reportEmptyState');
          if (!headerRow || !body || !emptyState) return;
          headerRow.innerHTML = '';
          body.innerHTML = '';

          definition.columns.forEach((column) => {
            const th = document.createElement('th');
            th.className = 'px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70';
            th.textContent = column;
            headerRow.appendChild(th);
          });

          if (!reportState.previewShown) {
            emptyState.style.display = 'block';
            return;
          }

          if (reportState.campusRestricted) {
            emptyState.style.display = 'none';
            const campusName = reportState.restrictedCampus || 'Selected Campus';
            const campusLabel = String(campusName).toUpperCase() + ' CAMPUS TOTAL';
            const totalRecords = Number(reportState.campusTotal || reportState.data.length || 0);
            const safeCampusName = String(campusName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            body.innerHTML = '<tr><td colspan="' + definition.columns.length + '" class="px-5 py-6 text-center"><div class="bg-red-950/20 border border-red-500/30 rounded-xl p-6 text-center max-w-lg mx-auto shadow-lg shadow-red-950/30 backdrop-blur-md"><div class="text-red-200 font-black text-lg uppercase tracking-[0.18em]">' + campusLabel + '</div><div class="mt-3 text-3xl font-black text-white">Total Records: ' + totalRecords + '</div><p class="mt-4 text-sm leading-6 text-red-100/85">Access Restricted: Detailed report records and individual item information are unavailable for ' + safeCampusName + '.</p></div></td></tr>';
            return;
          }

          if (!reportState.filteredData.length) {
            emptyState.style.display = 'block';
            return;
          }

          emptyState.style.display = 'none';
          const totalPages = Math.max(1, Math.ceil(reportState.filteredData.length / reportState.rowsPerPage));
          reportState.page = Math.min(Math.max(1, reportState.page || 1), totalPages);
          const startIndex = (reportState.page - 1) * reportState.rowsPerPage;
          const pageRows = reportState.filteredData.slice(startIndex, startIndex + reportState.rowsPerPage);

          pageRows.forEach((record) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-emerald-500/10';
            definition.columns.forEach((column) => {
              const td = document.createElement('td');
              td.className = 'px-4 py-4 align-top text-sm text-emerald-50/90';
              td.textContent = formatCell(getCellValue(record, column));
              row.appendChild(td);
            });
            body.appendChild(row);
          });
        };

        const renderReportPagination = () => {
          const paginationContainer = document.getElementById('reportPagination');
          if (!paginationContainer) return;

          const totalPages = Math.max(1, Math.ceil((reportState.filteredData?.length || 0) / reportState.rowsPerPage));
          reportState.page = Math.min(Math.max(1, reportState.page || 1), totalPages);

          paginationContainer.innerHTML = '';
          if (!reportState.previewShown || !reportState.filteredData.length || totalPages <= 1) {
            return;
          }

          const createButton = (label, page, isActive, isDisabled) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.className = isActive
              ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 font-bold text-white shadow-sm transition'
              : 'rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-900/60';
            if (isDisabled) {
              button.disabled = true;
              button.classList.add('cursor-not-allowed', 'opacity-40');
            } else {
              button.addEventListener('click', () => {
                reportState.page = page;
                renderReportPreview();
              });
            }
            return button;
          };

          paginationContainer.appendChild(createButton('Previous', reportState.page - 1, false, reportState.page <= 1));

          const maxVisiblePages = 3;
          const startPage = Math.max(1, Math.min(reportState.page - 1, totalPages - maxVisiblePages + 1));
          const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

          for (let page = startPage; page <= endPage; page += 1) {
            paginationContainer.appendChild(createButton(String(page), page, page === reportState.page, false));
          }

          paginationContainer.appendChild(createButton('Next', reportState.page + 1, false, reportState.page >= totalPages));
        };

        const renderReportPreview = () => {
          renderReportHeader();
          renderSummaryCards();
          renderReportTable();
          renderReportPagination();
          renderReportStatus();
          setExportButtonsRestricted(Boolean(reportState.campusRestricted));
        };

        const normalizeCampusKey = (value) => {
          const trimmed = String(value || '').trim();
          if (!trimmed || /^all\s+campuses?$/i.test(trimmed)) {
            return '';
          }
          return trimmed.replace(/\s*campus\s*$/i, '').trim().toLowerCase();
        };

        const getCurrentUserCampus = () => normalizeCampusKey(window.__CURRENT_USER__?.campus || '');

        const getRecordCampusValue = (record) => {
          if (!record) return '';
          const candidates = [
            record.campus,
            record.equipment?.campus,
            record?.laboratoryCampus,
            record?.labCampus,
            record?.campusName,
            record?.schoolCampus,
            record?.campus_name,
            record?.laboratory_room
          ];

          for (const value of candidates) {
            if (value !== null && value !== undefined && String(value).trim()) {
              return String(value).trim();
            }
          }

          return '';
        };

        const applyCampusAccessRules = (records, meta = {}) => {
          const data = Array.isArray(records) ? records : [];
          const selectedCampus = reportState.filters.campus || 'All Campuses';
          const userCampus = getCurrentUserCampus();

          if (meta && meta.restricted) {
            return {
              visibleRows: [],
              campusTotal: Number(meta.campusTotal || 0),
              isRestricted: true,
              restrictedCampus: meta.restrictedCampus || selectedCampus
            };
          }

          const normalizedSelectedCampus = normalizeCampusKey(selectedCampus);
          const hasExplicitCampusSelection = Boolean(reportState.campusFilterExplicitlySet && normalizedSelectedCampus);

          if (!userCampus) {
            return { visibleRows: data, campusTotal: Number(meta.campusTotal || data.length || 0), isRestricted: false, restrictedCampus: '' };
          }

          if (!normalizedSelectedCampus) {
            return {
              visibleRows: data,
              campusTotal: Number(meta.campusTotal || data.length || 0),
              isRestricted: false,
              restrictedCampus: ''
            };
          }

          if (normalizedSelectedCampus !== userCampus) {
            return {
              visibleRows: [],
              campusTotal: Number(meta.campusTotal || data.length || 0),
              isRestricted: true,
              restrictedCampus: selectedCampus
            };
          }

          const visibleRows = data.filter((row) => {
            const recordCampus = normalizeCampusKey(getRecordCampusValue(row));
            return !recordCampus || recordCampus === userCampus;
          });

          return {
            visibleRows: hasExplicitCampusSelection ? visibleRows : visibleRows,
            campusTotal: Number(meta.campusTotal || data.length || 0),
            isRestricted: false,
            restrictedCampus: ''
          };
        };

        const renderFilterStatus = () => {
          const statusLabel = document.getElementById('statusFilterLabel');
          if (!statusLabel) return;
          if (reportState.reportType === 'User Activity') {
            statusLabel.textContent = 'Activity';
          } else {
            statusLabel.textContent = 'Status';
          }
        };

        const loadReportData = async () => {
          const definition = reportDefinitions[reportState.reportType];
          const params = new URLSearchParams();
          params.set('reportType', reportState.reportType);
          params.set('campus', reportState.filters.campus || 'All Campuses');
          if (reportState.filters.laboratory) params.set('laboratory', reportState.filters.laboratory);
          if (reportState.filters.status) params.set('status', reportState.filters.status);
          params.set('reportPeriod', reportState.filters.reportPeriod || 'all');

          reportState.isLoading = true;
          reportState.data = [];
          reportState.filteredData = [];
          reportState.previewShown = false;
          reportState.generatedAt = '';
          reportState.campusRestricted = false;
          reportState.campusTotal = 0;
          reportState.restrictedCampus = '';
          reportState.page = 1;
          setGenerateButtonState(true);
          renderReportPreview();

          try {
            const url = definition.endpoint + '?' + params.toString();
            console.log('[Report] Loading data from:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
              console.error('[Report] API error:', response.status, response.statusText);
              throw new Error('Failed to load report data: ' + response.status);
            }
            
            const payload = await response.json();
            const rawRecords = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.records)
                ? payload.records
                : [];
            const payloadMeta = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.meta || {} : {};
            console.log('[Report] Received', rawRecords.length || 0, 'records');
            console.log('[Report] Report Type:', reportState.reportType);
            console.log('[Report] First record sample:', rawRecords[0]);
            console.log('[Report] Payload meta:', payloadMeta);

            const accessState = applyCampusAccessRules(rawRecords, payloadMeta);

            console.log('[Report] After campus access rules:', {
              rawCount: rawRecords.length,
              visibleCount: accessState.visibleRows.length,
              isRestricted: accessState.isRestricted,
              campusTotal: accessState.campusTotal
            });

            reportState.data = rawRecords;
            reportState.filteredData = accessState.visibleRows;
            reportState.campusRestricted = accessState.isRestricted || Boolean(payloadMeta.restricted);
            reportState.campusTotal = Number(accessState.campusTotal || payloadMeta.campusTotal || rawRecords.length || 0);
            reportState.restrictedCampus = accessState.restrictedCampus || payloadMeta.restrictedCampus || '';
            reportState.generatedAt = new Date().toLocaleString();
            reportState.previewShown = true;
            reportState.isLoading = false;
            renderReportPreview();
            renderFilterStatus();
          } catch (error) {
            console.error('[Report] Error loading report:', error);
            reportState.isLoading = false;
            reportState.data = [];
            reportState.filteredData = [];
            reportState.campusRestricted = false;
            reportState.campusTotal = 0;
            reportState.restrictedCampus = '';
            reportState.previewShown = true;
            reportState.generatedAt = new Date().toLocaleString();
            renderReportPreview();
          } finally {
            setGenerateButtonState(false);
          }
        };

        const handleReportTypeChange = () => {
          reportState.reportType = document.getElementById('reportTypeSelect').value;
          reportState.rowsPerPage = reportState.reportType === 'Attendance' ? 4 : 6;
          reportState.filters.status = '';
          reportState.filters.campus = '';
          reportState.filters.laboratory = '';
          reportState.filters.reportPeriod = 'all';
          reportState.campusFilterExplicitlySet = false;
          reportState.page = 1;
          document.getElementById('campusFilter').value = 'All Campuses';
          document.getElementById('laboratoryFilter').value = '';
          document.getElementById('statusFilter').value = '';
          document.getElementById('reportPeriodFilter').value = 'all';
          updateFilterOptions();
          renderFilterStatus();
          renderReportPreview();
        };

        const handleFilterChange = (changedFilter) => {
          reportState.filters.campus = document.getElementById('campusFilter').value;
          reportState.filters.laboratory = document.getElementById('laboratoryFilter').value;
          reportState.filters.status = document.getElementById('statusFilter').value;
          reportState.filters.reportPeriod = document.getElementById('reportPeriodFilter').value || 'all';
          if (changedFilter === 'campus') {
            reportState.campusFilterExplicitlySet = true;
            loadReportData();
          }
          reportState.page = 1;
        };

        const normalizePdfValue = (value, column) => {
          let text = value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
          if ((column === 'Status' || column === 'Condition') && /un\s*serviceable/i.test(text)) {
            text = 'Unserviceable';
          }
          return text;
        };

        const handleGenerateReport = (event) => {
          event.preventDefault();
          loadReportData();
        };

        hydrateAdminBadge();

        const buildPdfHtml = () => {
          const definition = reportDefinitions[reportState.reportType];
          const headers = definition.columns;
          const rows = reportState.filteredData.map((record) => headers.map((column) => normalizePdfValue(getCellValue(record, column), column)));
          const selectedFilters = [
            reportState.filters.campus ? 'Campus: ' + reportState.filters.campus : null,
            reportState.filters.laboratory ? 'Laboratory: ' + reportState.filters.laboratory : null,
            reportState.filters.status ? 'Status: ' + reportState.filters.status : null,
            reportState.filters.reportPeriod ? 'Report Period: ' + getReportPeriodLabel(reportState.filters.reportPeriod) : null
          ].filter(Boolean);
          const headerCells = headers.map(function(col) { return '<th>' + String(col).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</th>'; }).join('');
          const rowCells = rows.map(function(row) {
            return '<tr>' + row.map(function(cell) { return '<td>' + String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</td>'; }).join('') + '</tr>';
          }).join('');
          const preparedBy = window.__CURRENT_USER_NAME__ || 'Administrator';
          return '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>' + definition.title + '</title><style>body{font-family:Inter, Arial, sans-serif; background:#f8fafc; color:#0f172a; padding:24px;} .header{border-bottom:2px solid #16a34a; padding-bottom:12px; margin-bottom:16px;} .muted{color:#64748b;} table{width:100%; border-collapse:collapse; margin-top:16px;} th,td{border:1px solid #dbe3eb; padding:10px; text-align:left; font-size:12px;} th{background:#0f172a; color:#fff;} th:nth-child(4), td:nth-child(4){min-width:90px;} th:nth-child(4), th:nth-child(5), th:nth-child(6), td:nth-child(5), td:nth-child(6){white-space:nowrap;} .pill{display:inline-block; border-radius:999px; background:#dcfce7; color:#166534; padding:4px 10px; font-size:12px; margin-right:8px; margin-top:8px;} .section{margin-bottom:12px;}</style></head><body><div class="header"><h1 style="margin:0 0 6px 0; color:#0f172a;">Mindoro State University</h1><div class="muted">College of Computer Studies</div><div class="muted">Computer Laboratory Facilities Management System</div></div><div class="section"><h2 style="margin:0 0 6px 0;">' + definition.title + '</h2><div class="muted">Date Generated: ' + (reportState.generatedAt || new Date().toLocaleString()) + '</div></div><div class="section"><div><strong>Applied Filters</strong></div><div>' + (selectedFilters.length ? selectedFilters.map(function(filter) { return '<span class="pill">' + filter + '</span>'; }).join('') : '<span class="pill">None</span>') + '</div></div><div class="section"><strong>Total Records:</strong> ' + rows.length + '</div><div class="section"><strong>Prepared By:</strong> ' + preparedBy + '</div><table><thead><tr>' + headerCells + '</tr></thead><tbody>' + rowCells + '</tbody></table></body></html>';
        };

        const buildPdfData = () => {
          const definition = reportDefinitions[reportState.reportType];
          const headers = definition.columns;
          const rows = reportState.filteredData.map((record) => headers.map((column) => normalizePdfValue(getCellValue(record, column), column)));
          const selectedFilters = [
            reportState.filters.campus ? 'Campus: ' + reportState.filters.campus : null,
            reportState.filters.laboratory ? 'Laboratory: ' + reportState.filters.laboratory : null,
            reportState.filters.status ? 'Status: ' + reportState.filters.status : null,
            reportState.filters.reportPeriod ? 'Report Period: ' + getReportPeriodLabel(reportState.filters.reportPeriod) : null
          ].filter(Boolean);

          return { definition, headers, rows, selectedFilters };
        };

        function exportReport(format) {
          if (reportState.campusRestricted) {
            alert('You can view the total record count for this campus, but you are not allowed to view the detailed records.');
            return;
          }

          if (!reportState.previewShown || !reportState.filteredData.length) {
            alert('No records found for the selected filters.');
            return;
          }

          if (format === 'print') {
            const printWindow = window.open('', '_blank', 'width=900,height=700');
            if (!printWindow) {
              alert('Please allow popups to print the report.');
              return;
            }

            printWindow.document.write(buildPdfHtml());
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            return;
          }

          if (format === 'pdf') {
            const pdfLib = window.jspdf && window.jspdf.jsPDF;
            if (!pdfLib) {
              const printWindow = window.open('', '_blank', 'width=900,height=700');
              if (!printWindow) {
                alert('Please allow popups so the report can be printed as PDF.');
                return;
              }

              printWindow.document.write(buildPdfHtml());
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
              return;
            }

            const { definition, headers, rows, selectedFilters } = buildPdfData();
            const preparedBy = window.__CURRENT_USER_NAME__ || 'Administrator';
            const normalizePdfValue = (value, column) => {
              let text = value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
              if ((column === 'Status' || column === 'Condition') && /un\s*serviceable/i.test(text)) {
                text = 'Unserviceable';
              }
              return text;
            };
            const safeText = (value) => {
              if (value === null || value === undefined) return '';
              return String(value).replace(/\s+/g, ' ').trim();
            };

            const doc = new pdfLib({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 40;
            const cellPadding = 4;
            const footerHeight = 28;
            const tableFontSize = 8.7;

            const preparedByText = preparedBy;

            const safeTextMeasure = (v) => {
              if (v === null || v === undefined) return '';
              return String(v).replace(/\s+/g, ' ').trim();
            };

            // Colors (emerald accents)
            const emeraldDeep = [15,56,30]; // #0f381e
            const emeraldText = [6,78,59]; // #064e3b
            const emeraldDivider = [16,185,129]; // #10b981

            // Institutional header (centered)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(...emeraldText);
            doc.text('MINDORO STATE UNIVERSITY', pageWidth / 2, 56, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text('College of Computer Studies', pageWidth / 2, 76, { align: 'center' });
            doc.text('Computer Laboratory Facilities Management System', pageWidth / 2, 92, { align: 'center' });

            // divider (emerald)
            const dividerY = 106; // header -> divider spacing
            doc.setDrawColor(...emeraldDivider);
            doc.setLineWidth(2);
            doc.line(margin, dividerY, pageWidth - margin, dividerY);

            // Report title (positioned with spacing)
            const titleY = dividerY + 16; // margin-top:16
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...emeraldText);
            doc.text((definition.title || '').toUpperCase(), pageWidth / 2, titleY, { align: 'center' });

            // Metadata box (two-column) with light emerald tint
            const metaTop = titleY + 12; // title margin-bottom:12
            const metaBoxHeight = 66;
            doc.setFillColor(240,253,244); // #f0fdf4
            doc.setDrawColor(209,250,229); // #d1fae5
            doc.setLineWidth(1);
            doc.rect(margin, metaTop, pageWidth - margin * 2, metaBoxHeight, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(60);
            const midX = margin + (pageWidth - margin * 2) / 2;

            const isAttendance = ((reportState.reportType || '').toLowerCase().includes('attendance')) || ((definition.title || '').toLowerCase().includes('attendance'));
            if (isAttendance) {
              // Attempt to extract class/session info from data
              const sample = (reportState.filteredData && reportState.filteredData.length) ? reportState.filteredData[0] : {};
              const subject = sample.subject || sample.course || sample.title || sample.equipmentName || '';
              const instructor = sample.instructor || sample.instructorName || sample.teacher || sample.preparedBy || '';
              const dateLabel = sample.date || sample.sessionDate || reportState.generatedAt || new Date().toLocaleDateString();
              const timeLabel = (sample.time || (sample.startTime && sample.endTime ? (sample.startTime + ' - ' + sample.endTime) : '')) || '';

              // Left column: Subject / Instructor / Date & Time
              doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...emeraldDeep);
              doc.text('Subject:', margin + 8, metaTop + 16);
              doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
              doc.text(String(subject || '—'), margin + 70, metaTop + 16, { maxWidth: (pageWidth - margin * 2) / 2 - 90 });

              doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...emeraldDeep);
              doc.text('Instructor:', margin + 8, metaTop + 34);
              doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
              doc.text(String(instructor || '—'), margin + 70, metaTop + 34, { maxWidth: (pageWidth - margin * 2) / 2 - 90 });

              doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...emeraldDeep);
              doc.text('Date & Time:', margin + 8, metaTop + 52);
              doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
              doc.text(String((dateLabel || '') + (timeLabel ? ' • ' + timeLabel : '')), margin + 110, metaTop + 52, { maxWidth: (pageWidth - margin * 2) / 2 - 120 });

              // Right column: Present / Absent / Late counts
              const summary = getReportSummary(reportState.filteredData || []);
              const presentItem = summary.find(s=>/present/i.test(s.label));
              const absentItem = summary.find(s=>/absent/i.test(s.label));
              const lateItem = summary.find(s=>/late/i.test(s.label));
              const presentCount = presentItem ? presentItem.value : 0;
              const absentCount = absentItem ? absentItem.value : 0;
              const lateCount = lateItem ? lateItem.value : 0;

              const badgeX = midX + 12;
              const badgeY = metaTop + 18;
              const badgeW = 120;
              const badgeH = 18;

              // Present badge
              doc.setFillColor(220,252,231); // #dcfce7
              doc.setDrawColor(220,252,231);
              doc.rect(badgeX, badgeY - 12, badgeW, badgeH, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21,128,61); // #15803d
              doc.text('Present: ' + presentCount, badgeX + 8, badgeY + 2);

              // Absent badge
              doc.setFillColor(255,228,230); // #ffe4e6
              doc.setDrawColor(255,228,230);
              doc.rect(badgeX, badgeY + 8, badgeW, badgeH, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(185,28,28); // #b91c1c
              doc.text('Absent: ' + absentCount, badgeX + 8, badgeY + 22);

              // Late badge
              doc.setFillColor(254,243,199); // #fef3c7
              doc.setDrawColor(254,243,199);
              doc.rect(badgeX + badgeW + 8, badgeY - 12, badgeW, badgeH, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(180,83,9); // #b45309
              doc.text('Late: ' + lateCount, badgeX + badgeW + 8 + 8, badgeY + 2);

            } else {
              doc.text('Date Generated:', margin + 8, metaTop + 14);
              doc.text(reportState.generatedAt || new Date().toLocaleString(), margin + 110, metaTop + 14);
              doc.text('Prepared By:', midX + 8, metaTop + 14);
              doc.text(preparedByText, midX + 110, metaTop + 14);
              const filtersText = (selectedFilters && selectedFilters.length) ? selectedFilters.join(' • ') : 'None';
              doc.text('Applied Filters:', margin + 8, metaTop + 34);
              doc.text(filtersText, margin + 110, metaTop + 34, { maxWidth: (pageWidth - margin * 2) / 2 - 120 });
              doc.text('Total Records:', midX + 8, metaTop + 34);
              doc.text(String(rows.length), midX + 110, metaTop + 34);
            }

            // Prepare table metrics
            const startYBase = metaTop + metaBoxHeight + 20; // metadata margin-bottom:20

            const availWidth = pageWidth - margin * 2;

            // If this is the equipment inventory report, use explicit percentages
            let columnWidths = [];
            if ((reportState.reportType || '').toLowerCase().includes('attendance') || (definition.title || '').toLowerCase().includes('attendance')) {
              // Attendance columns: Student, Laboratory, Date, Time In, Time Out, Status
              const percents = [0.28, 0.20, 0.16, 0.12, 0.12, 0.12];
              columnWidths = headers.map((h, i) => Math.floor(availWidth * (percents[i] || (1 / headers.length))));
              const assigned = columnWidths.reduce((a,b)=>a+b,0);
              if (assigned < availWidth) columnWidths[columnWidths.length-1] += (availWidth - assigned);
            } else if ((reportState.reportType || '').toLowerCase().includes('equipment') || (definition.title || '').toLowerCase().includes('equipment')) {
              // Equipment columns: Equipment ID, Equipment Name, Laboratory, Campus, Status, Condition
              const percents = [0.12, 0.22, 0.10, 0.24, 0.16, 0.16];
              columnWidths = headers.map((h, i) => Math.floor(availWidth * (percents[i] || (1 / headers.length))));
              const minHeaderWidths = headers.map((h, i) => Math.ceil(doc.getTextWidth(String(h || '').toUpperCase()) + cellPadding * 4));
              columnWidths = columnWidths.map((width, i) => Math.max(width, minHeaderWidths[i]));
              let assigned = columnWidths.reduce((a, b) => a + b, 0);
              if (assigned < availWidth) columnWidths[columnWidths.length - 1] += (availWidth - assigned);
              if (assigned > availWidth) columnWidths[columnWidths.length - 1] -= (assigned - availWidth);
            } else {
              // fallback: proportional widths based on content
              const colWeights = headers.map((h, ci) => {
                const headerLen = String(h || '').length;
                const maxCellLen = rows.reduce((m, r) => Math.max(m, String(r[ci] || '').length), 0);
                return Math.max(headerLen, maxCellLen, 4);
              });
              const totalWeight = colWeights.reduce((a, b) => a + b, 0) || 1;
              columnWidths = colWeights.map(w => Math.max(60, Math.min(400, Math.floor(availWidth * (w / totalWeight)))));
              const assigned = columnWidths.reduce((a, b) => a + b, 0);
              if (assigned < availWidth) columnWidths[columnWidths.length - 1] += (availWidth - assigned);
              if (assigned > availWidth) columnWidths[columnWidths.length - 1] -= (assigned - availWidth);
            }

            const rowHeight = 24;
            let currentY = startYBase;

            const statusColIndex = headers.findIndex(h => /status/i.test(String(h || '')));

            const wrapCellText = (text, maxWidth) => {
              if (text === null || text === undefined || text === '') return [''];
              const normalized = String(text).replace(/\s+/g, ' ').trim();
              if (!normalized) return [''];
              return doc.splitTextToSize(normalized, Math.max(18, maxWidth));
            };

            const drawHeaderRow = () => {
              const headerY = currentY;
              doc.setFillColor(...emeraldDeep);
              doc.rect(margin, headerY - 8, availWidth, rowHeight + 6, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(255);
              let x = margin + cellPadding;
              headers.forEach((h, i) => {
                const w = columnWidths[i] || Math.floor(availWidth / headers.length);
                doc.text(String(h || '').toUpperCase(), x, headerY + 8, { maxWidth: w - cellPadding * 2 });
                x += w;
              });
              doc.setTextColor(0);
              currentY += rowHeight + 8;
            };

            const drawRow = (cells, rowIndex) => {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(tableFontSize);
              const wrappedCells = cells.map((c, i) => {
                const w = columnWidths[i] || Math.floor(availWidth / headers.length);
                const text = safeTextMeasure(c);
                const maxWidth = Math.max(18, w - cellPadding * 2);
                const lines = wrapCellText(text, maxWidth);
                return { lines, width: w, textHeight: Math.max(14, lines.length * 8) };
              });
              const rowBlockHeight = Math.max(rowHeight, ...wrappedCells.map(item => item.textHeight)) + 6;

              if (currentY + rowBlockHeight > pageHeight - margin - footerHeight) {
                doc.addPage();
                currentY = margin;
                drawHeaderRow();
              }

              const y = currentY;
              if (rowIndex % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y - 2, availWidth, rowBlockHeight, 'F');
              }
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.5);
              let x = margin;
              wrappedCells.forEach((cell, i) => {
                const w = cell.width;
                const textY = y + 8;
                const lines = cell.lines;
                const maxTextWidth = Math.max(18, w - cellPadding * 2);
                const lineHeight = 8;

                if (i === statusColIndex && lines[0]) {
                  const lower = String(lines.join(' ')).toLowerCase();
                  let bg = null;
                  let fg = [6,78,59];
                  if (/(serviceable|available|working)/i.test(lower)) bg = [220,255,235];
                  else if (/(unserviceable|broken|unavailable)/i.test(lower)) bg = [255,235,238];
                  else if (/(pending|in progress)/i.test(lower)) bg = [255,249,230];

                  if (bg) {
                    const pillX = x + cellPadding;
                    const pillY = y + 4;
                    const pillWidth = Math.min(Math.max(40, Math.max(...lines.map((line) => doc.getTextWidth(line))) + 8), maxTextWidth);
                    const pillHeight = Math.max(14, lines.length * lineHeight + 6);
                    doc.setFillColor(...bg);
                    doc.rect(pillX, pillY, pillWidth, pillHeight, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.2);
                    doc.setTextColor(...fg);
                    lines.forEach((line, index) => {
                      doc.text(line, pillX + 4, pillY + 4 + index * lineHeight);
                    });
                  } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.2);
                    doc.setTextColor(20);
                    lines.forEach((line, index) => {
                      doc.text(line, x + cellPadding, textY + index * lineHeight);
                    });
                  }
                } else {
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(tableFontSize - 0.4);
                  doc.setTextColor(20);
                  lines.forEach((line, index) => {
                    doc.text(line, x + cellPadding, textY + index * lineHeight);
                  });
                }

                doc.rect(x, y - 2, w, rowBlockHeight, 'S');
                x += w;
              });
              currentY += rowBlockHeight;
            };

            // Draw table
            drawHeaderRow();
            rows.forEach((r, idx) => drawRow(r, idx));

            // Footer with verification text and page numbers
            const totalPages = doc.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
              doc.setPage(p);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.setTextColor(100);
              doc.text('Generated by Computer Laboratory Facilities Management System', margin, pageHeight - 22);
              doc.text('Page ' + p + ' of ' + totalPages, pageWidth - margin, pageHeight - 22, { align: 'right' });
            }

            const fileName = (definition.title || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf';
            doc.save(fileName);
          }
        };

        document.addEventListener('DOMContentLoaded', () => {
          updateFilterOptions();
          renderFilterStatus();
          renderReportPreview();
        });
      </script>
    `
  },
  "maintenance-queue": {
    title: "Maintenance Queue",
    description: "Track incoming equipment issues assigned to technicians.",
    backRoute: "/technician-dashboard",
    backLabel: "Back to Technician Dashboard",
    content: `
      <section class="table-card mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h3 class="text-xl font-semibold text-gray-900">Open Requests</h3>
            <p class="text-sm text-gray-600">Review and accept pending maintenance tasks.</p>
          </div>
          <button class="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700">
            <i class="fas fa-plus"></i> New Request
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left divide-y divide-gray-200 text-sm text-gray-700">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3">Request</th>
                <th class="px-4 py-3">Equipment</th>
                <th class="px-4 py-3">Priority</th>
                <th class="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Replace sensor board</td>
                <td class="px-4 py-4">3D Printer #2</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-red-100 text-red-700">High</span></td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span></td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Calibrate oscilloscope</td>
                <td class="px-4 py-4">Oscilloscope 101</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">Medium</span></td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">In progress</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `
  },
  "repair-history": {
    title: "Repair History",
    description: "Review completed repairs and equipment maintenance logs.",
    backRoute: "/technician-dashboard",
    backLabel: "Back to Technician Dashboard",
    content: `
      <section class="table-card">
        <div class="mb-5">
          <h3 class="text-xl font-semibold text-gray-900">Completed Repairs</h3>
          <p class="text-sm text-gray-600">Historical repair records with service details.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left divide-y divide-gray-200 text-sm text-gray-700">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Equipment</th>
                <th class="px-4 py-3">Issue</th>
                <th class="px-4 py-3">Technician</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">May 28, 2026</td>
                <td class="px-4 py-4">3D Printer #1</td>
                <td class="px-4 py-4">Extruder rebuild</td>
                <td class="px-4 py-4">Liza Tan</td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">May 21, 2026</td>
                <td class="px-4 py-4">Cooling System</td>
                <td class="px-4 py-4">Pump replacement</td>
                <td class="px-4 py-4">Marco Lim</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `
  },
  "statistics": {
    title: "Statistics",
    description: "See performance metrics for equipment and lab usage.",
    backRoute: "/admin-dashboard",
    backLabel: "Back to Admin Dashboard",
    content: `
      <section class="grid gap-4 md:grid-cols-3 mb-6">
        <div class="card">
          <p class="text-sm uppercase tracking-wide text-gray-500">Uptime</p>
          <h2 class="mt-3 text-3xl font-bold text-gray-900">97%</h2>
        </div>
        <div class="card">
          <p class="text-sm uppercase tracking-wide text-gray-500">Utilization</p>
          <h2 class="mt-3 text-3xl font-bold text-green-600">82%</h2>
        </div>
        <div class="card">
          <p class="text-sm uppercase tracking-wide text-gray-500">Issues Logged</p>
          <h2 class="mt-3 text-3xl font-bold text-gray-900">15</h2>
        </div>
      </section>
      <div class="table-card">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">Summary Metrics</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-3xl bg-gray-50 p-5 border border-gray-200">
            <p class="font-medium text-gray-900">Equipment Availability</p>
            <p class="mt-2 text-sm text-gray-600">Current serviceable equipment is performing above target.</p>
          </div>
          <div class="rounded-3xl bg-gray-50 p-5 border border-gray-200">
            <p class="font-medium text-gray-900">Student Check-in Rate</p>
            <p class="mt-2 text-sm text-gray-600">Average attendance continues to improve this term.</p>
          </div>
        </div>
      </div>
    `
  },
  "schedule": {
    title: "Schedule",
    description: "View your upcoming sessions and personal timetable.",
    backRoute: "/student-dashboard",
    backLabel: "Back to Student Dashboard",
    content: `
      <section class="grid gap-4 md:grid-cols-3 mb-6">
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Next Class</p>
          <h2 class="mt-3 text-3xl font-bold text-gray-900">Network Lab</h2>
          <p class="text-sm text-gray-600 mt-2">Jun 4, 2026 • 9:00 AM</p>
        </div>
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Credits</p>
          <h2 class="mt-3 text-3xl font-bold text-green-600">18</h2>
        </div>
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Lab Sessions</p>
          <h2 class="mt-3 text-3xl font-bold text-gray-900">5</h2>
        </div>
      </section>
      <div class="card">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-xl font-semibold text-gray-900">Weekly Timetable</h3>
            <p class="text-sm text-gray-600">Your classes and lab sessions for the current week.</p>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-3xl bg-gray-50 p-5 border border-gray-200">
            <p class="font-semibold text-gray-800">Thursday</p>
            <p class="text-sm text-gray-600 mt-2">Network Lab • 9:00 AM - 11:00 AM • Room 302</p>
          </div>
          <div class="rounded-3xl bg-gray-50 p-5 border border-gray-200">
            <p class="font-semibold text-gray-800">Friday</p>
            <p class="text-sm text-gray-600 mt-2">Robotics • 1:00 PM - 3:00 PM • Room 204</p>
          </div>
        </div>
      </div>
    `
  },
  "my-attendance": {
    title: "My Attendance",
    description: "Track your own attendance history and class participation.",
    backRoute: "/student-dashboard",
    backLabel: "Back to Student Dashboard",
    content: `
      <section class="grid gap-4 md:grid-cols-3 mb-6">
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Days Present</p>
          <h2 class="mt-3 text-3xl font-bold text-green-600">42</h2>
        </div>
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Days Absent</p>
          <h2 class="mt-3 text-3xl font-bold text-red-600">3</h2>
        </div>
        <div class="card sm">
          <p class="text-sm uppercase tracking-wide text-gray-500">Late</p>
          <h2 class="mt-3 text-3xl font-bold text-amber-600">1</h2>
        </div>
      </section>
      <div class="card">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">Attendance Record</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left divide-y divide-gray-200 text-sm text-gray-700">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Class</th>
                <th class="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Jun 3, 2026</td>
                <td class="px-4 py-4">Automation Lab</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Present</span></td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Jun 1, 2026</td>
                <td class="px-4 py-4">Power Systems</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-green-100 text-green-700">Present</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  },
  "report-damage": {
    title: "Report Damage",
    description: "Submit new damage reports for broken or malfunctioning equipment.",
    backRoute: "/student-dashboard",
    backLabel: "Back to Student Dashboard",
    content: `
      <section class="card">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">Report Damaged Equipment</h3>
        <form class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700">Equipment</label>
            <input type="text" placeholder="3D Printer #2" class="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-600" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Location</label>
            <input type="text" placeholder="Electronics Lab" class="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-600" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Description</label>
            <textarea rows="5" placeholder="Describe the issue..." class="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-600"></textarea>
          </div>
          <button class="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700">Submit report</button>
        </form>
      </section>
    `
  },
  "feedback": {
    title: "Feedback",
    description: "Send suggestions or report issues to the ComLab team.",
    backRoute: "/student-dashboard",
    backLabel: "Back to Student Dashboard",
    content: `
      <section class="grid gap-4 md:grid-cols-2 mb-6">
        <div class="card sm">
          <h3 class="text-lg font-semibold text-gray-900">Need help?</h3>
          <p class="mt-2 text-sm text-gray-600">Send feedback about lab equipment, schedules, or system improvements.</p>
        </div>
        <div class="card sm">
          <h3 class="text-lg font-semibold text-gray-900">Recent Responses</h3>
          <p class="mt-2 text-sm text-gray-600">Our team aims to respond within 24 hours.</p>
        </div>
      </section>
      <section class="card">
        <form class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700">Subject</label>
            <input type="text" placeholder="Feedback subject" class="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-600" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Message</label>
            <textarea rows="6" placeholder="Write your feedback here..." class="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-600"></textarea>
          </div>
          <button class="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700">Submit feedback</button>
        </form>
      </section>
    `
  },
  "maintenance-requests": {
    title: "Maintenance Requests",
    description: "Manage assigned maintenance jobs and technician tasks.",
    backRoute: "/technician-dashboard",
    backLabel: "Back to Technician Dashboard",
    content: `
      <section class="table-card mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h3 class="text-xl font-semibold text-gray-900">Active Maintenance</h3>
            <p class="text-sm text-gray-600">Track open requests and update progress.</p>
          </div>
          <button class="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700">
            <i class="fas fa-check"></i> Mark Complete
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left divide-y divide-gray-200 text-sm text-gray-700">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3">Request</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Assigned</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Sensor calibration</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700">In progress</span></td>
                <td class="px-4 py-4">Carlos</td>
              </tr>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-4">Replace broken PSU</td>
                <td class="px-4 py-4"><span class="px-3 py-1 rounded-full bg-red-100 text-red-700">Pending</span></td>
                <td class="px-4 py-4">Mia</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `
  }
};

const serveHtmlPage = (req, res) => {
  const page = req.params.page || req.path.replace(/^\//, "");
  if (!staticHtmlPages.includes(page)) return res.status(404).send("Page not found");

  if (page === "attendance" && req.query?.token) {
    return scanAttendance(req, res);
  }

  const dashboardPath = path.join(process.cwd(), `${page}.html`);
  const currentUserId = req.session?.userId;

  const loadDashboard = async () => {
    if (!currentUserId) {
      return res.redirect("/login");
    }

    let currentUser = null;

    const user = await User.findByPk(currentUserId, {
      attributes: ["name", "email", "role", "student_number", "program", "year", "section", "campus", "photo"]
    });

    if (user) {
      const userName = user.name || (page === "student-dashboard" ? "Student" : "Technician");
      const initials = userName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "ST";

      currentUser = {
        id: currentUserId,
        name: userName,
        email: user.email || "",
        role: user.role || (page === "student-dashboard" ? "student" : "technician"),
        studentId: user.student_number || user.studentId || user.student_id || "",
        student_number: user.student_number || user.studentId || user.student_id || "",
        program: user.program || "",
        year: user.year || "",
        section: user.section || "",
        campus: user.campus || null,
        yearSection: [user.year, user.section].filter(Boolean).join(" • "),
        course: user.program || "",
        photo: user.photo || null,
        initials
      };
    }

    const html = await fs.promises.readFile(dashboardPath, "utf8");
    const hydratedHtml = html.replaceAll(
      "__CURRENT_USER_JSON__",
      JSON.stringify(currentUser)
    );

    res.type("html").send(hydratedHtml);
  };

  loadDashboard().catch(error => {
    console.error(`Failed to render ${page}:`, error);
    res.status(500).send("Failed to load dashboard.");
  });
};

const renderFeaturePage = (config, currentUserName = "Administrator", pageName = "", currentUserCampus = "") => {
  const hideTopHeaderPages = ["attendance-monitoring", "laboratory-schedules", "user-management", "reports", "audit-logs"];
  const showTopHeader = !hideTopHeaderPages.includes(pageName);
  const pageContentStyle = hideTopHeaderPages.includes(pageName) ? ' style="padding-top: 0.35rem !important;"' : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title} | ComLab</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/css/sidebar.css">
</head>
<body class="app-shell">
  <script>window.__CURRENT_USER_NAME__ = ${JSON.stringify(currentUserName)}; window.__CURRENT_USER_CAMPUS__ = ${JSON.stringify(currentUserCampus || "")};</script>
  <div id="shared-sidebar"></div>
  <div class="main-container">
    ${showTopHeader ? `<div class="top-header">
      <div class="header-left flex items-center space-x-3 pl-14 lg:pl-0">
        <button id="mobileMenuToggle" class="menu-toggle fixed left-4 top-4 z-50 block lg:hidden" onclick="toggleSidebar()" aria-label="Open navigation">
          <i class="fas fa-bars"></i>
        </button>
        <div class="header-meta ml-3">
          <h2 class="header-title">${config.title}</h2>
          <p class="text-sm text-gray-400 mt-1">${config.description}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" placeholder="Search..." />
        </div>
        <div class="header-icons"></div>
        <div class="user-profile">
          <div class="user-avatar">AD</div>
          <div class="user-info">
            <span class="user-name">Admin User</span>
            <span class="user-role">Administrator</span>
          </div>
          <i class="fas fa-chevron-down" style="color: #94f9b3; font-size: 0.75rem;"></i>
        </div>
      </div>
    </div>` : ""}

    <main class="page-content"${pageContentStyle}>
      ${config.content}
    </main>
  </div>
  <script src="/js/sidebar-component.js" defer></script>
</body>
</html>`;
};

const serveFeaturePage = async (req, res) => {
  const page = req.params.page;
  const config = pageConfigs[page];
  if (!config) return res.status(404).send("Page not found");

  if (page === "audit-logs") {
    if (canBypassAuditAccessForDev(req)) {
      // Development bypass allowed for the local Audit Logs debug UI.
    } else if (!req.session?.userId) {
      return res.status(403).send("Forbidden: admin only.");
    } else {
      const sessionRole = normalizeRoleName(getRequestRoleValue(req));
      const isSessionAdmin = isAdminRole(sessionRole);
      if (!isSessionAdmin) {
        try {
          const currentUser = await User.findByPk(req.session.userId, { attributes: ["role"] });
          if (!isAdminRole(currentUser?.role)) {
            return res.status(403).send("Forbidden: admin only.");
          }
        } catch (error) {
          console.error("Failed to resolve current user role for Audit Logs page access.", error);
          return res.status(403).send("Forbidden: admin only.");
        }
      }
    }
  }

  let currentUserName = "Administrator";
  let currentUserCampus = "";
  const currentUserId = req.session?.userId;
  if (currentUserId) {
    try {
      const currentUser = await User.findByPk(currentUserId, { attributes: ["name", "campus"] });
      if (currentUser?.name) {
        currentUserName = currentUser.name;
      }
      currentUserCampus = currentUser?.campus || "";
    } catch (error) {
      console.error("Failed to load current user for feature page:", error);
    }
  }

  res.send(renderFeaturePage(config, currentUserName, page, currentUserCampus));
};

// ==================== Laboratory Schedule Helper Functions ====================

// Canonical room map for normalizing room names
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

// Normalize room values for consistent matching
const normalizeRoom = (value) => {
  if (!value && value !== '') return null;
  const key = String(value || '').trim().toLowerCase();
  if (CANONICAL_ROOM_MAP[key]) return CANONICAL_ROOM_MAP[key];
  // If already canonical
  for (const v of Object.values(CANONICAL_ROOM_MAP)) {
    if (String(v).toLowerCase() === key) return v;
  }
  return null;
};

// Normalize campus values
const normalizeCampus = (value) => {
  if (!value && value !== '') return null;
  const key = String(value || '').trim().toLowerCase();
  const campusMap = {
    'bongabong': 'Bongabong',
    'calapan': 'Calapan',
    'victoria': 'Victoria'
  };
  return campusMap[key] || null;
};

// Allowed days for scheduling
const ALLOWED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Parse time string (e.g., "9:00 AM") to date
const parseScheduleClockTime = (value, referenceDate = new Date()) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hours === 12) hours = 0;
  if (meridiem === "PM" && hours !== 12) hours += 12;

  const date = new Date(referenceDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Check if two time ranges overlap
const timeRangesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

// Find conflicting schedules
const findConflictingSchedule = async ({ laboratoryRoom, dayOfWeek, campus, startTime, endTime, excludeId = null } = {}) => {
  if (!laboratoryRoom || !dayOfWeek || !campus || !startTime || !endTime) return null;

  try {
    const schedules = await LaboratorySchedule.findAll({
      where: {
        laboratoryRoom,
        dayOfWeek,
        campus
      }
    });

    const checkStart = parseScheduleClockTime(startTime);
    const checkEnd = parseScheduleClockTime(endTime);
    if (!checkStart || !checkEnd) return null;

    for (const schedule of schedules) {
      // Skip the current schedule if editing
      if (excludeId && schedule.id == excludeId) continue;

      const scheduleStart = parseScheduleClockTime(schedule.startTime);
      const scheduleEnd = parseScheduleClockTime(schedule.endTime);
      if (!scheduleStart || !scheduleEnd) continue;

      if (timeRangesOverlap(checkStart, checkEnd, scheduleStart, scheduleEnd)) {
        return schedule;
      }
    }
    return null;
  } catch (error) {
    console.error("Error checking for conflicting schedules:", error);
    return null;
  }
};

// Parse class list from file buffer (supports XLSX, XLS, CSV)
const parseClassListRows = async (buffer, originalname = "") => {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", blankrows: false });

    return rows
      .map((row) => ({
        studentId: row['Student ID'] || row['studentId'] || row['ID'] || row['id'] || '',
        fullName: row['Full Name'] || row['fullName'] || row['Name'] || row['name'] || '',
        courseSection: row['Course Section'] || row['courseSection'] || row['Section'] || row['section'] || '',
        program: row['Program'] || row['program'] || '',
        year: row['Year'] || row['year'] || '',
        section: row['Section'] || row['section'] || '',
        email: row['Email'] || row['email'] || ''
      }))
      .filter((row) => row.studentId && row.fullName);
  } catch (error) {
    console.error("Error parsing class list:", error);
    return [];
  }
};

// ==================== End Laboratory Schedule Helper Functions ====================

router.get("/", homePage);
router.get("/landing", (req, res) => res.redirect("/"));
router.get("/equipment-inventory", inventoryPage);
router.get("/borrow-equipment", serveHtmlPage);
router.get("/equipment/view/:equipmentId", viewEquipmentPage);
router.get("/admin-dashboard", serveHtmlPage);
router.get("/maintenance-monitoring", (req, res) => {
  req.params.page = "admin-dashboard";
  return serveHtmlPage(req, res);
});
router.get("/attendance", serveHtmlPage);
router.get("/maintenance-reports", serveHtmlPage);
router.get("/student-dashboard", serveHtmlPage);
router.get("/student-borrow-equipment", serveHtmlPage);
router.get("/student-profile", serveHtmlPage);
router.get("/student/report-issue", (req, res) => res.redirect("/student-report-issue"));
router.get("/student/my-requests", (req, res) => res.redirect("/student-my-requests"));
router.get("/student/profile", (req, res) => res.redirect("/student-profile"));
router.get("/student/dashboard", (req, res) => res.redirect("/student-dashboard"));
router.get("/student/borrow-equipment", async (req, res) => {
  const currentUserId = req.session?.userId;
  if (!currentUserId) return res.redirect("/login");

  try {
    const user = await User.findByPk(currentUserId, {
      attributes: ["name", "email", "role", "student_number", "program", "year", "section", "campus", "photo"]
    });

    const currentUser = user ? {
      id: currentUserId,
      name: user.name || "Student",
      email: user.email || "",
      role: user.role || "student",
      studentId: user.student_number || "",
      student_number: user.student_number || "",
      program: user.program || "",
      year: user.year || "",
      section: user.section || "",
      campus: user.campus || null,
      yearSection: [user.year, user.section].filter(Boolean).join(" • "),
      course: user.program || "",
      photo: user.photo || null,
      initials: (user.name || "Student").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join("") || "ST"
    } : null;

    const html = await fs.promises.readFile(path.join(process.cwd(), "student-borrow-equipment.html"), "utf8");
    const hydratedHtml = html.replaceAll("__CURRENT_USER_JSON__", JSON.stringify(currentUser));
    res.type("html").send(hydratedHtml.replace("window.__CURRENT_USER__ = __CURRENT_USER_JSON__;", `window.__CURRENT_USER__ = ${JSON.stringify(currentUser)};`));
  } catch (error) {
    console.error("Failed to render student borrow page:", error);
    res.status(500).send("Failed to load Borrow Equipment page.");
  }
});
router.get("/student-report-issue", serveHtmlPage);
router.get("/student-my-requests", serveHtmlPage);
router.get("/technician-dashboard", serveHtmlPage);
router.get("/page/:page", serveFeaturePage);

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.post("/api/profile", updateProfile);
router.post("/api/student/photo", uploadStudentPhoto);
router.get("/forgot-password", forgotPasswordPage);
router.post("/forgot-password", forgotPassword);
router.get('/verify-otp', verifyOtpPage);
router.post('/verify-otp', verifyOtp);
router.get('/resend-otp', resendOtp);
router.get('/reset-password', resetPasswordPage);
router.post('/reset-password', resetPassword);
router.get('/check-your-email', (req, res) => res.render('check-email', { title: 'Check your email' }));
router.get('/verify-email/:token', verifyEmail);
router.get("/dashboard", dashboardPage);
router.get("/logout", logoutUser);

router.get("/api/equipment", getEquipment);
router.get("/api/equipment/campus-totals", getEquipmentCampusTotals);
router.get("/api/equipment/:id/qr", getEquipmentQr);
router.post("/api/equipment", createEquipment);
router.put("/api/equipment/:id", updateEquipment);
router.put("/api/equipment/:id/status", updateEquipmentStatus);
router.delete("/api/equipment/:id", deleteEquipment);
router.get("/api/equipment-categories", getEquipmentCategories);
router.post("/api/equipment-categories", createEquipmentCategory);
router.delete("/api/equipment-categories/:id", deleteEquipmentCategory);
router.get("/api/borrow-records", listBorrowRecords);
router.post("/api/borrow-records", createBorrowRecord);
router.put("/api/borrow-records/:id/approve", approveBorrowRecord);
router.put("/api/borrow-records/:id/reject", rejectBorrowRecord);
router.put("/api/borrow-records/:id/return", returnBorrowRecord);
router.put("/api/borrow-records/:id/mark-lost", markBorrowRecordLost);
router.get("/api/borrow-records/:id/history", getBorrowHistory);
router.get("/api/equipment-availability", listEquipmentAvailability);
router.get("/api/equipment-availability/:equipmentId/history", getEquipmentBorrowingHistory);
router.get("/api/admin/notifications", listBorrowNotifications);
router.get("/api/borrow-notifications", listBorrowNotifications);
router.put("/api/borrow-notifications/:id/read", markBorrowNotificationRead);
router.get("/api/audit-logs", requireAdminForAudit, getAuditLogs);
router.get("/api/announcements", (req, res) => {
  res.json([]);
});
router.get("/api/attendance/records", getAttendanceRecords);
router.get("/api/attendance/stats", getAttendanceStats);
router.get("/api/instructor/attendance-dashboard", getInstructorAttendanceDashboard);
router.get("/api/instructor/attendance-dashboard/:sessionId", getInstructorAttendanceSessionDetails);
router.get("/api/attendance/scan", scanAttendance);
router.post("/api/attendance/scan", scanAttendance);
router.get("/attendance/scan/:token", scanAttendance);
router.post("/attendance/scan/:token", scanAttendance);
router.post("/api/attendance/session", createAttendanceSession);
router.get("/api/laboratory-schedules", async (req, res) => {
  try {
    const userId = req.session?.userId || null;
    const userRole = String(req.session?.userRole || "").toLowerCase();
    if (!userId) return res.status(401).json({ error: "Please log in to view schedules." });

    // Get user's campus for filtering
    const userCampus = await getUserCampusFromSession(req);
    
    // Safe default: do not expose schedules to unauthenticated users.
    // Ownership semantics:
    // - Admins: see schedules they created (createdBy === userId) and unowned schedules (createdBy IS NULL) so existing records remain visible until claimed.
    // - Instructors/technicians: see only schedules they created (createdBy === userId).
    const where = {};
    if (userRole === 'admin') {
      where[Op.or] = [
        { createdBy: userId },
        { createdBy: null }
      ];
    } else if (userRole === 'instructor' || userRole === 'technician') {
      where.createdBy = userId;
    } else {
      // Students and others: no schedules returned
      return res.json([]);
    }

    // Add campus filter - users can only see schedules from their campus
    if (userCampus) {
      const campusName = String(userCampus).trim().replace(/\s*Campus\s*$/i, "");
      where.campus = { [Op.in]: [campusName, `${campusName} Campus`] };
    }

    const schedules = await LaboratorySchedule.findAll({
      where,
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    const scheduleIds = schedules.map((schedule) => schedule.id).filter(Boolean);
    const classListCounts = scheduleIds.length
      ? await ClassListEntry.findAll({
          attributes: [
            'laboratoryScheduleId',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          where: { laboratoryScheduleId: { [Op.in]: scheduleIds } },
          group: ['laboratoryScheduleId']
        })
      : [];

    const countMap = new Map(classListCounts.map((entry) => [String(entry.laboratoryScheduleId), Number(entry.get('count') || 0)]));

    res.json(schedules.map((schedule) => {
      const item = schedule.toJSON();
      return {
        ...item,
        classListCount: countMap.get(String(item.id)) || 0
      };
    }));
  } catch (error) {
    console.error("Failed to load laboratory schedules", error);
    res.status(500).json({ error: "Failed to load laboratory schedules" });
  }
});
router.post("/api/laboratory-schedules", upload.single("classListFile"), async (req, res) => {
  try {
    const { subject, instructor, laboratoryRoom, campus, dayOfWeek, startTime, endTime, status, qrEnabled, classList } = req.body;
    const uploadedFile = req.file;
    const sessionUserId = req.session?.userId || null;

    console.log("[schedule-upload] content-type:", req.headers["content-type"]);
    console.log("[schedule-upload] req.body:", req.body);
    console.log("[schedule-upload] request.file:", uploadedFile ? { fieldname: uploadedFile.fieldname, originalname: uploadedFile.originalname, mimetype: uploadedFile.mimetype, size: uploadedFile.size } : null);
    console.log("[schedule-upload] session userId:", sessionUserId);
    console.log("[schedule-upload] session userRole:", req.session?.userRole);

    if (!subject || !laboratoryRoom || !campus || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ error: "All schedule fields are required" });
    }

    // Campus-based authorization check
    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) {
      return res.status(403).json({ error: "Unauthorized: User campus not found." });
    }
    if (!canManageRecord(userCampus, campus)) {
      return res.status(403).json({ error: "You do not have permission to create schedules for another campus." });
    }

    // Normalize and validate laboratory room and campus and day
    const canonicalRoom = normalizeRoom(laboratoryRoom);
    if (!canonicalRoom) {
      return res.status(400).json({ error: "Invalid laboratory room. Allowed: Laboratory 1 — Room 202, Laboratory 2 — Room 204" });
    }

    const canonicalCampus = normalizeCampus(campus);
    if (!canonicalCampus) {
      return res.status(400).json({ error: "Invalid campus. Allowed: Bongabong, Calapan, Victoria" });
    }

    if (!ALLOWED_DAYS.includes(dayOfWeek)) {
      return res.status(400).json({ error: "Invalid day. Allowed: Monday–Sunday" });
    }

    // Check for schedule conflicts before creating (authoritative server-side check)
    const conflict = await findConflictingSchedule({ laboratoryRoom: canonicalRoom, dayOfWeek, campus: canonicalCampus, startTime, endTime });
    if (conflict) {
      return res.status(409).json({
        error: "Schedule Conflict",
        message: `Room ${canonicalRoom} is already scheduled for ${conflict.subject} on ${conflict.dayOfWeek} from ${conflict.startTime} to ${conflict.endTime}`,
        conflict: {
          id: conflict.id,
          subject: conflict.subject,
          laboratoryRoom: conflict.laboratoryRoom,
          dayOfWeek: conflict.dayOfWeek,
          startTime: conflict.startTime,
          endTime: conflict.endTime
        }
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const schedule = await LaboratorySchedule.create({
        subject,
        instructor: instructor || null,
        laboratoryRoom: canonicalRoom,
        campus: canonicalCampus,
        createdBy: sessionUserId || null,
        dayOfWeek,
        startTime,
        endTime,
        status: status || "Confirmed",
        qrEnabled: Boolean(qrEnabled)
      }, { transaction });

      const existingSession = await AttendanceSession.findOne({
        where: { laboratoryScheduleId: schedule.id },
        transaction
      });

      if (!existingSession) {
        const sessionToken = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await AttendanceSession.create({
          token: sessionToken,
          title: subject,
          day: dayOfWeek,
          time: [startTime, endTime].filter(Boolean).join(" - "),
          room: canonicalRoom,
          courseSection: null,
          status: status || "Confirmed",
          laboratoryScheduleId: schedule.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }, { transaction });
      }

      let parsedStudents = [];
      const hasClassListInput = Boolean(uploadedFile?.buffer || (typeof classList === "string" && classList.length) || (Array.isArray(classList) && classList.length));

      if (typeof classList === "string") {
        try {
          const parsedJson = JSON.parse(classList);
          parsedStudents = Array.isArray(parsedJson) ? parsedJson : [];
        } catch (error) {
          console.warn("[schedule-upload] classList JSON parse failed", error.message);
        }
      } else if (Array.isArray(classList)) {
        parsedStudents = classList;
      }

      if (!parsedStudents.length && uploadedFile?.buffer) {
        parsedStudents = await parseClassListRows(uploadedFile.buffer, uploadedFile.originalname);
        console.log("[schedule-upload] parsed rows count:", parsedStudents.length);
        if (parsedStudents[0]) {
          console.log(parsedStudents[0]);
          console.log("typeof studentId:", typeof parsedStudents[0].studentId);
          console.log("studentId:", parsedStudents[0].studentId);
          console.log("[schedule-upload] first parsed student:", parsedStudents[0]);
          console.dir(parsedStudents[0], { depth: null });
        }
      }

      const validEntries = parsedStudents
        .filter((entry) => entry && entry.studentId && entry.fullName)
        .map((entry) => ({
          laboratoryScheduleId: schedule.id,
          studentId: String(entry.studentId).trim(),
          fullName: String(entry.fullName).trim(),
          courseSection: entry.courseSection ? String(entry.courseSection).trim() : null,
          program: entry.program ? String(entry.program).trim() : null,
          year: entry.year ? String(entry.year).trim() : null,
          section: entry.section ? String(entry.section).trim() : null,
          email: entry.email ? String(entry.email).trim() : null
        }));

      const students = validEntries;
      console.dir(students, { depth: null });
      students.forEach((s, i) => {
        console.log("Student", i);
        console.log("studentId =", s.studentId);
        console.log("typeof =", typeof s.studentId);
        console.log("length =", String(s.studentId).length);
      });
      if (students[0]) {
        console.dir(students[0], { depth: null });
      }

      if (students.length) {
        const session = await AttendanceSession.findOne({ where: { laboratoryScheduleId: schedule.id }, transaction });
        const placeholderRecords = students.map((entry) => ({
          studentId: entry.studentId,
          fullName: entry.fullName,
          courseSection: entry.courseSection || "",
          subject: subject,
          lab: laboratoryRoom,
          instructor: instructor || "Instructor",
          date: new Date().toISOString().slice(0, 10),
          timeIn: "Not recorded",
          status: "Absent",
          sessionToken: session?.token || null,
          laboratoryScheduleId: schedule.id
        }));

        if (placeholderRecords.length) {
          await Attendance.bulkCreate(placeholderRecords, { transaction, ignoreDuplicates: true });
        }
      }

      console.log("[schedule-upload] students prepared for insertion:", validEntries.length);
      if (validEntries[0]) {
        console.log("[schedule-upload] first prepared student:", validEntries[0]);
      }
      console.log("[schedule-upload] bulkCreate payload size:", validEntries.length);
      console.log("[schedule-upload] bulkCreate payload (sample up to 20):", validEntries.slice(0, 20));

      if (hasClassListInput && !validEntries.length) {
        await transaction.rollback();
        console.log("[schedule-upload] no valid students to insert; execution stopped before bulkCreate.");
        return res.status(400).json({ error: "No students could be parsed from the uploaded class list." });
      }

      if (validEntries.length) {
        console.dir(validEntries, { depth: null });
        validEntries.forEach((s, i) => {
          console.log("Student", i);
          console.log("studentId =", s.studentId);
          console.log("typeof =", typeof s.studentId);
          console.log("length =", String(s.studentId).length);
        });
        try {
          const [schemaResult] = await sequelize.query("SHOW CREATE TABLE class_list_entries");
          console.log("[schedule-upload] class_list_entries schema:", JSON.stringify(schemaResult, null, 2));
        } catch (schemaError) {
          console.error("[schedule-upload] failed to query table schema:", schemaError);
        }
        const bulkCreateResult = await ClassListEntry.bulkCreate(validEntries, { transaction });
        console.log("[schedule-upload] bulkCreate result:", bulkCreateResult);
        console.log("[schedule-upload] total inserted records:", bulkCreateResult?.length || 0);
      }

      await transaction.commit();
      console.log("[schedule-upload] transaction committed successfully");
      console.log("[schedule-upload] schedule created with ID:", schedule.id);

      await logAuditEntry(req, {
        action: "Laboratory Schedule Created",
        module: "Laboratory Scheduling",
        resourceId: schedule.id,
        description: `Created laboratory schedule ${schedule.subject} (${schedule.id}).`,
        details: {
          scheduleId: schedule.id,
          subject: schedule.subject,
          instructor: schedule.instructor,
          laboratoryRoom: schedule.laboratoryRoom,
          campus: schedule.campus,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: schedule.status,
          createdBy: schedule.createdBy
        }
      });

      res.status(201).json({ schedule: schedule.toJSON() });
    } catch (error) {
      await transaction.rollback();
      console.error("[schedule-upload] transaction rolled back due to error", error);
      console.error("\n========== ERROR CREATING LABORATORY SCHEDULE ==========");
      console.error("Error name:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("SQL:", error?.sql);
      console.error("Parent error:", error?.parent?.message);
      console.error("Full error object:", error);
      console.error("\nStack trace:");
      console.error(error?.stack);

      let errorMessage = "Failed to create laboratory schedule";
      if (error?.errors && error.errors.length > 0) {
        console.error("\nSequelize validation errors:");
        error.errors.forEach((err, i) => {
          console.error(`  [${i}] ${err.path}: ${err.message}`);
        });
        errorMessage = error.errors[0].message || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.parent?.message) {
        errorMessage = error.parent.message;
      }
      console.error("==============================================\n");

      res.status(500).json({ error: errorMessage, details: error?.message });
    }
  } catch (error) {
    console.error("[schedule-upload] outer request handler failed", error);
    res.status(500).json({ error: error?.message || "Failed to create laboratory schedule" });
  }
});
router.put("/api/laboratory-schedules/:id", upload.single("classListFile"), async (req, res) => {
  try {
    const schedule = await LaboratorySchedule.findByPk(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const sessionUserId = req.session?.userId || null;
    const sessionUserRole = String(req.session?.userRole || "").toLowerCase();

    // Ownership enforcement: only allow updates if the schedule is owned by the user,
    // or if it is unowned (createdBy === null) and the user is an admin (allows claiming existing schedules).
    if (!(String(schedule.createdBy || '') === String(sessionUserId)) && !(schedule.createdBy === null && sessionUserRole === 'admin')) {
      return res.status(403).json({ error: 'Not authorized to update this schedule.' });
    }

    // Campus-based authorization check
    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) {
      return res.status(403).json({ error: "Unauthorized: User campus not found." });
    }
    if (!canManageRecord(userCampus, schedule.campus)) {
      return res.status(403).json({ error: "You do not have permission to update schedules from another campus." });
    }

    const { subject, instructor, laboratoryRoom, campus, dayOfWeek, startTime, endTime, status, qrEnabled, classList } = req.body;
    const uploadedFile = req.file;
    console.log("[schedule-upload-edit] content-type:", req.headers["content-type"]);
    console.log("[schedule-upload-edit] req.body:", req.body);
    console.log("[schedule-upload-edit] request.file:", uploadedFile ? { fieldname: uploadedFile.fieldname, originalname: uploadedFile.originalname, mimetype: uploadedFile.mimetype, size: uploadedFile.size } : null);
    if (!subject || !laboratoryRoom || !campus || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ error: "All schedule fields are required" });
    }

    // Normalize and validate laboratory room, campus, and day for edits
    const canonicalRoom = normalizeRoom(laboratoryRoom);
    if (!canonicalRoom) {
      return res.status(400).json({ error: "Invalid laboratory room. Allowed: Laboratory 1 — Room 202, Laboratory 2 — Room 204" });
    }

    const canonicalCampus = normalizeCampus(campus);
    if (!canonicalCampus) {
      return res.status(400).json({ error: "Invalid campus. Allowed: Bongabong, Calapan, Victoria" });
    }

    if (!ALLOWED_DAYS.includes(dayOfWeek)) {
      return res.status(400).json({ error: "Invalid day. Allowed: Monday–Sunday" });
    }

    const transaction = await sequelize.transaction();
    try {
      await schedule.update({
        subject,
        instructor: instructor || null,
        laboratoryRoom: canonicalRoom,
        campus: canonicalCampus,
        dayOfWeek,
        startTime,
        endTime,
        status: status || "Confirmed",
        qrEnabled: Boolean(qrEnabled)
      }, { transaction });

      // Run conflict detection for edits (exclude current schedule id)
      const editConflict = await findConflictingSchedule({ laboratoryRoom: canonicalRoom, dayOfWeek, campus: canonicalCampus, startTime, endTime, excludeId: schedule.id });
      if (editConflict) {
        await transaction.rollback();
        return res.status(409).json({
          error: "Schedule Conflict",
          message: `Room ${laboratoryRoom} is already scheduled for ${editConflict.subject} on ${editConflict.dayOfWeek} from ${editConflict.startTime} to ${editConflict.endTime}`,
          conflict: {
            id: editConflict.id,
            subject: editConflict.subject,
            laboratoryRoom: editConflict.laboratoryRoom,
            dayOfWeek: editConflict.dayOfWeek,
            startTime: editConflict.startTime,
            endTime: editConflict.endTime
          }
        });
      }

      if (uploadedFile?.buffer || typeof classList === "string" || Array.isArray(classList)) {
        await ClassListEntry.destroy({ where: { laboratoryScheduleId: schedule.id }, transaction });

        let parsedStudents = [];
        if (uploadedFile?.buffer) {
          parsedStudents = await parseClassListRows(uploadedFile.buffer, uploadedFile.originalname);
          console.log("[schedule-upload-edit] parsed rows count:", parsedStudents.length);
          if (parsedStudents[0]) {
            console.log(parsedStudents[0]);
            console.log("typeof studentId:", typeof parsedStudents[0].studentId);
            console.log("studentId:", parsedStudents[0].studentId);
            console.log("[schedule-upload-edit] first parsed student:", parsedStudents[0]);
            console.dir(parsedStudents[0], { depth: null });
          }
        } else if (typeof classList === "string") {
          try {
            const parsedJson = JSON.parse(classList);
            parsedStudents = Array.isArray(parsedJson) ? parsedJson : [];
          } catch (error) {
            console.warn("[schedule-upload-edit] classList JSON parse failed", error.message);
          }
        } else if (Array.isArray(classList)) {
          parsedStudents = classList;
        }

        const validEntries = parsedStudents
          .filter((entry) => entry && entry.studentId && entry.fullName)
          .map((entry) => ({
            laboratoryScheduleId: schedule.id,
            studentId: String(entry.studentId).trim(),
            fullName: String(entry.fullName).trim(),
            courseSection: entry.courseSection ? String(entry.courseSection).trim() : null,
            program: entry.program ? String(entry.program).trim() : null,
            year: entry.year ? String(entry.year).trim() : null,
            section: entry.section ? String(entry.section).trim() : null,
            email: entry.email ? String(entry.email).trim() : null
          }));

        const students = validEntries;
        console.dir(students, { depth: null });
        students.forEach((s, i) => {
          console.log("Student", i);
          console.log("studentId =", s.studentId);
          console.log("typeof =", typeof s.studentId);
          console.log("length =", String(s.studentId).length);
        });
        if (students[0]) {
          console.dir(students[0], { depth: null });
        }

        console.log("[schedule-upload-edit] students prepared for insertion:", students.length);
        if (students[0]) {
          console.log("[schedule-upload-edit] first prepared student:", students[0]);
        }
        console.log("[schedule-upload-edit] bulkCreate payload size:", students.length);
        if (students.length) {
        console.log("[schedule-upload-edit] bulkCreate payload (sample up to 20):", students.slice(0,20));
        try {
          const [schemaResult] = await sequelize.query("SHOW CREATE TABLE class_list_entries");
          console.log("[schedule-upload-edit] class_list_entries schema:", JSON.stringify(schemaResult, null, 2));
        } catch (schemaError) {
          console.error("[schedule-upload-edit] failed to query table schema:", schemaError);
        }
        const bulkCreateResult = await ClassListEntry.bulkCreate(students, { transaction });
          console.log("[schedule-upload-edit] bulkCreate result:", bulkCreateResult);
          console.log("[schedule-upload-edit] total inserted records:", bulkCreateResult?.length || 0);
        } else {
          console.log("[schedule-upload-edit] no valid students to insert; execution stopped before bulkCreate.");
        }
      }

      await transaction.commit();
      console.log("[schedule-upload-edit] transaction committed successfully");

      await logAuditEntry(req, {
        action: "Laboratory Schedule Updated",
        module: "Laboratory Scheduling",
        resourceId: schedule.id,
        description: `Updated laboratory schedule ${schedule.subject} (${schedule.id}).`,
        details: {
          scheduleId: schedule.id,
          subject: schedule.subject,
          instructor: schedule.instructor,
          laboratoryRoom: schedule.laboratoryRoom,
          campus: schedule.campus,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: schedule.status,
          qrEnabled: schedule.qrEnabled
        }
      });

      res.json({ success: true, schedule: schedule.toJSON(), message: "Schedule updated successfully." });
    } catch (error) {
      await transaction.rollback();
      console.error("[schedule-upload-edit] transaction rolled back due to error", error);
      console.error("Failed to update laboratory schedule", error);
      res.status(500).json({ error: "Failed to update laboratory schedule" });
    }
  } catch (error) {
    console.error("[schedule-upload-edit] outer request handler failed", error);
    res.status(500).json({ error: error?.message || "Failed to update laboratory schedule" });
  }
});

// Attendance Monitoring APIs
const getAttendanceAccessContext = async (req) => {
  const context = await getUserAuthContext(req);
  const role = normalizeRoleName(context.role || req.session?.userRole);
  if (!context.userId) return { errorStatus: 401, errorMessage: 'Please log in to view attendance.' };
  if (!isAdminRole(role) && role !== 'instructor' && role !== 'technician') {
    return { errorStatus: 403, errorMessage: 'Not authorized.' };
  }
  if (!context.campus || !String(context.campus).trim()) {
    return { errorStatus: 403, errorMessage: 'Unauthorized: User campus not found.' };
  }
  return { context, role };
};

const getAttendanceCampusWhere = (campus) => {
  const canonicalCampus = String(campus || '').trim().replace(/\s*Campus\s*$/i, '').trim();
  return {
    [Op.or]: [
      { campus: canonicalCampus },
      { campus: `${canonicalCampus} Campus` }
    ]
  };
};

router.get('/api/attendance-sessions', async (req, res) => {
  try {
    const access = await getAttendanceAccessContext(req);
    if (access.errorStatus) return res.status(access.errorStatus).json({ error: access.errorMessage });
    const { context, role } = access;

    const where = {};
    if (isAdminRole(role)) {
      where[Op.and] = [
        { [Op.or]: [ { createdBy: context.userId }, { createdBy: null } ] },
        getAttendanceCampusWhere(context.campus)
      ];
    } else {
      where[Op.and] = [
        { createdBy: context.userId },
        getAttendanceCampusWhere(context.campus)
      ];
    }

    const schedules = await LaboratorySchedule.findAll({ where, order: [['createdAt', 'DESC']] });

    const results = [];
    for (const s of schedules) {
      const id = s.id;
      const total = await ClassListEntry.count({ where: { laboratoryScheduleId: id } });
      const session = await AttendanceSession.findOne({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'DESC']] });
      const attendanceRecords = session
        ? await Attendance.findAll({ where: { sessionToken: session.token }, order: [['createdAt', 'ASC']] })
        : await Attendance.findAll({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'ASC']] });
      const latestStatusByStudent = new Map();
      attendanceRecords.forEach((record) => {
        const studentId = String(record.studentId || '').trim();
        if (!studentId) return;
        latestStatusByStudent.set(studentId, record.status);
      });
      const present = [...latestStatusByStudent.values()].filter((status) => status === 'Present').length;
      const late = [...latestStatusByStudent.values()].filter((status) => status === 'Late').length;
      const absent = Math.max(0, total - present - late);

      results.push({
        id,
        subject: s.subject,
        instructor: s.instructor,
        dayOfWeek: s.dayOfWeek,
        time: [s.startTime, s.endTime].filter(Boolean).join(' - '),
        laboratoryRoom: s.laboratoryRoom,
        campus: s.campus,
        createdAt: s.createdAt,
        totalStudents: total,
        present,
        absent,
        late,
        status: s.status || 'Completed'
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Failed to load attendance sessions', error);
    res.status(500).json({ error: 'Failed to load attendance sessions' });
  }
});

router.get('/api/attendance-sessions/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const access = await getAttendanceAccessContext(req);
    if (access.errorStatus) return res.status(access.errorStatus).json({ error: access.errorMessage });
    const { context } = access;
    const schedule = await LaboratorySchedule.findOne({
      where: { id, ...getAttendanceCampusWhere(context.campus) }
    });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    if (!(String(schedule.createdBy || '') === String(context.userId)) && !(schedule.createdBy === null && isAdminRole(context.role))) {
      return res.status(403).json({ error: 'Not authorized to view this attendance session.' });
    }
    // Ensure session exists
    const session = await AttendanceSession.findOne({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'DESC']] });

    // Auto-mark absent if session exists and has expired
    if (session && session.expiresAt && new Date() > new Date(session.expiresAt)) {
      const classList = await ClassListEntry.findAll({ where: { laboratoryScheduleId: id } });
      const toCreate = [];
      for (const c of classList) {
        const existing = await Attendance.findOne({ where: { sessionToken: session.token, studentId: c.studentId } });
        if (!existing) {
          toCreate.push({
            laboratoryScheduleId: id,
            studentId: c.studentId,
            fullName: c.fullName,
            status: 'Absent',
            timeIn: null,
            remarks: 'Automatically marked absent',
            sessionToken: session.token
          });
        }
      }
      if (toCreate.length) {
        try {
          await Attendance.bulkCreate(toCreate, { ignoreDuplicates: true });
        } catch (err) {
          console.error('[attendance-monitor] failed to bulk-create absent records', err);
        }
      }
    }

    const students = await ClassListEntry.findAll({ where: { laboratoryScheduleId: id }, order: [['fullName', 'ASC']] });
    const attendance = session && session.token
      ? await Attendance.findAll({ where: { sessionToken: session.token }, order: [['createdAt', 'ASC']] })
      : await Attendance.findAll({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'ASC']] });

    // Map attendance by studentId
    const attendanceMap = new Map(attendance.map(a => [String(a.studentId), a]));

    const rows = students.map((c) => {
      const a = attendanceMap.get(String(c.studentId));
      return {
        studentId: c.studentId,
        fullName: c.fullName,
        status: a?.status || 'Absent',
        timeIn: a?.timeIn || null,
        remarks: a?.remarks || (a ? '' : 'Automatically marked absent')
      };
    });

    const format = (req.query.format || 'json').toLowerCase();
    if (format === 'excel') {
      const wsData = [
        ['Subject', schedule.subject],
        ['Instructor', schedule.instructor || ''],
        ['Laboratory', schedule.laboratoryRoom || ''],
        ['Campus', schedule.campus || ''],
        [],
        ['Student ID', 'Full Name', 'Status', 'Time In', 'Remarks']
      ];
      for (const r of rows) wsData.push([r.studentId, r.fullName, r.status, r.timeIn || '', r.remarks || '']);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="Attendance_Report.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Length', buf.length);
      return res.send(buf);
    }

    const present = rows.filter(r => r.status === 'Present').length;
    const late = rows.filter(r => r.status === 'Late').length;
    const absent = Math.max(0, rows.length - present - late);

    res.json({
      schedule: schedule.toJSON(),
      summary: { total: rows.length, present, absent, late, attendancePercentage: rows.length ? Math.round((present / rows.length) * 100) : 0 },
      rows
    });
  } catch (error) {
    console.error('Failed to load attendance session details', error);
    res.status(500).json({ error: 'Failed to load attendance session details' });
  }
});

router.get('/api/attendance-sessions/:id/export', async (req, res) => {
  try {
    const id = req.params.id;
    const format = (req.query.format || 'excel').toLowerCase();
    const access = await getAttendanceAccessContext(req);
    if (access.errorStatus) return res.status(access.errorStatus).send(access.errorMessage);
    const { context } = access;
    const schedule = await LaboratorySchedule.findOne({
      where: { id, ...getAttendanceCampusWhere(context.campus) }
    });
    if (!schedule) return res.status(404).send('Schedule not found');
    if (!(String(schedule.createdBy || '') === String(context.userId)) && !(schedule.createdBy === null && isAdminRole(context.role))) {
      return res.status(403).send('Not authorized to export attendance for this schedule.');
    }
    const session = await AttendanceSession.findOne({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'DESC']] });
    const students = await ClassListEntry.findAll({ where: { laboratoryScheduleId: id }, order: [['fullName', 'ASC']] });
    const attendance = session && session.token
      ? await Attendance.findAll({ where: { sessionToken: session.token }, order: [['createdAt', 'ASC']] })
      : await Attendance.findAll({ where: { laboratoryScheduleId: id }, order: [['createdAt', 'ASC']] });
    const attendanceMap = new Map(attendance.map(a => [String(a.studentId), a]));

    const rows = students.map((c) => {
      const a = attendanceMap.get(String(c.studentId));
      return {
        studentId: c.studentId,
        fullName: c.fullName,
        status: a?.status || 'Absent',
        timeIn: a?.timeIn || '',
        remarks: a?.remarks || (a ? '' : 'Automatically marked absent')
      };
    });

    if (format === 'excel') {
      const wsData = [
        ['Subject', schedule.subject],
        ['Instructor', schedule.instructor || ''],
        ['Laboratory', schedule.laboratoryRoom || ''],
        ['Campus', schedule.campus || ''],
        [],
        ['Student ID', 'Full Name', 'Status', 'Time In', 'Remarks']
      ];
      for (const r of rows) wsData.push([r.studentId, r.fullName, r.status, r.timeIn || '', r.remarks || '']);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename=attendance-${id}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    let html = `<!doctype html><html><head><meta charset='utf8'><title>Attendance ${schedule.subject}</title></head><body>`;
    html += `<h1>${schedule.subject}</h1><p>Instructor: ${schedule.instructor || ''}</p><table border='1' cellpadding='6' cellspacing='0'><thead><tr><th>Student ID</th><th>Full Name</th><th>Status</th><th>Time In</th><th>Remarks</th></tr></thead><tbody>`;
    for (const r of rows) html += `<tr><td>${r.studentId}</td><td>${r.fullName}</td><td>${r.status}</td><td>${r.timeIn || ''}</td><td>${r.remarks || ''}</td></tr>`;
    html += `</tbody></table></body></html>`;
    res.setHeader('Content-Disposition', `inline; filename=attendance-${id}.html`);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Failed to export attendance', error);
    res.status(500).send('Failed to export attendance');
  }
});
router.delete("/api/laboratory-schedules/:id", async (req, res) => {
  try {
    const schedule = await LaboratorySchedule.findByPk(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const sessionUserId = req.session?.userId || null;
    const sessionUserRole = String(req.session?.userRole || "").toLowerCase();

    if (!(String(schedule.createdBy || '') === String(sessionUserId)) && !(schedule.createdBy === null && sessionUserRole === 'admin')) {
      return res.status(403).json({ error: 'Not authorized to delete this schedule.' });
    }

    // Campus-based authorization check
    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) {
      return res.status(403).json({ error: "Unauthorized: User campus not found." });
    }
    if (!canManageRecord(userCampus, schedule.campus)) {
      return res.status(403).json({ error: "You do not have permission to delete schedules from another campus." });
    }

    await schedule.destroy();
    await logAuditEntry(req, {
      action: "Laboratory Schedule Deleted",
      module: "Laboratory Scheduling",
      resourceId: schedule.id,
      description: `Deleted laboratory schedule ${schedule.subject || schedule.id}.`,
      details: {
        scheduleId: schedule.id,
        subject: schedule.subject,
        laboratoryRoom: schedule.laboratoryRoom,
        campus: schedule.campus,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        deletedBy: req.session?.userId || null
      }
    });
    res.json({ success: true, message: "Schedule deleted successfully." });
  } catch (error) {
    console.error("Failed to delete laboratory schedule", error);
    res.status(500).json({ error: "Failed to delete laboratory schedule" });
  }
});

// GET - List users (optional role filter)
router.get("/api/users", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Please log in to view users." });
    }

    const { role } = req.query;
    const where = {};
    if (String(req.query.auditScope || '') === '1') {
      const authContext = await getUserAuthContext(req);
      const normalizedRole = normalizeRoleName(authContext.role || '');
      const normalizedCampus = String(authContext.campus || '').trim().replace(/\s*Campus\s*$/i, '').trim();
      const isCentralAdmin = ['superadmin', 'centraladmin', 'systemadmin'].includes(normalizedRole.replace(/[_-]+/g, ''));
      if (!isCentralAdmin) {
        if (!normalizedCampus) return res.status(403).json({ error: 'Unauthorized: User campus not found.' });
        where[Op.or] = [
          { campus: normalizedCampus },
          { campus: `${normalizedCampus} Campus` }
        ];
      }
    }
    if (role) {
      const normalizedRole = String(role).trim().toLowerCase();
      if (normalizedRole === "admin") {
        where[Op.or] = [{ role: "admin" }, { role: "Administrator" }, { role: "administrator" }];
      } else {
        where.role = normalizedRole;
      }
    }

    const users = await User.findAll({
      where,
      attributes: ["id", "name", "email", "role", "student_number", "campus", "createdAt", "updatedAt", "last_login_at"],
      order: [["name", "ASC"]]
    });
    console.log('[API Users] Returning', users.length, 'users');
    res.json(users);
  } catch (err) {
    console.error('[API Users] Error:', err.message);
    res.status(500).json({ error: "Failed to load users." });
  }
});

const formatDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRangeFromReportPeriod = (reportPeriod = "all") => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (reportPeriod === "today") {
    return { dateFrom: formatDateValue(today), dateTo: formatDateValue(today) };
  }

  if (reportPeriod === "week") {
    const firstDay = new Date(today);
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    firstDay.setDate(today.getDate() + diff);
    const lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + 6);
    return { dateFrom: formatDateValue(firstDay), dateTo: formatDateValue(lastDay) };
  }

  if (reportPeriod === "month") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { dateFrom: formatDateValue(firstDay), dateTo: formatDateValue(lastDay) };
  }

  if (reportPeriod === "semester") {
    const semesterStart = today.getMonth() >= 7
      ? new Date(today.getFullYear(), 7, 1)
      : new Date(today.getFullYear() - 1, 7, 1);
    const semesterEnd = today.getMonth() >= 7
      ? new Date(today.getFullYear(), 11, 31)
      : new Date(today.getFullYear(), 4, 31);
    return { dateFrom: formatDateValue(semesterStart), dateTo: formatDateValue(semesterEnd) };
  }

  if (reportPeriod === "school-year") {
    const schoolYearStart = today.getMonth() >= 7
      ? new Date(today.getFullYear(), 7, 1)
      : new Date(today.getFullYear() - 1, 7, 1);
    const schoolYearEnd = today.getMonth() >= 7
      ? new Date(today.getFullYear() + 1, 6, 31)
      : new Date(today.getFullYear(), 6, 31);
    return { dateFrom: formatDateValue(schoolYearStart), dateTo: formatDateValue(schoolYearEnd) };
  }

  return {};
};

const normalizeReportFilterValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return String(value).trim();
  return value.trim();
};

const normalizeReportedCampusValue = (value) => {
  const normalized = normalizeReportFilterValue(value).toLowerCase();
  if (!normalized || normalized === "all" || normalized === "all campuses" || normalized === "all campus") {
    return "";
  }
  return normalized.replace(/\s*campus\s*$/i, "");
};

const getReportCampusVariants = (campus) => {
  const campusKey = normalizeReportedCampusValue(campus);
  if (!campusKey) return [];
  return [...new Set([campusKey, `${campusKey} campus`])];
};

const isGlobalReportAdmin = (role) => {
  const normalizedRole = normalizeReportFilterValue(role).toLowerCase().replace(/[_-]+/g, "");
  return ["superadmin", "centraladmin", "systemadmin"].includes(normalizedRole);
};

const getReportAccessState = async (req, requestedCampus = "") => {
  const authContext = await getUserAuthContext(req);
  if (!authContext.userId) {
    return { errorStatus: 401, errorMessage: "Please log in to view reports." };
  }
  const authenticatedUser = await User.findByPk(authContext.userId, { attributes: ["role", "campus"] });
  if (!authenticatedUser) {
    return { errorStatus: 403, errorMessage: "Not authorized to view reports." };
  }
  const userCampus = String(authenticatedUser.campus || "").trim();
  const globalAdmin = isGlobalReportAdmin(authenticatedUser.role || authContext.role);
  const userCampusKey = normalizeReportedCampusValue(userCampus);
  const explicitSelectedCampus = normalizeReportedCampusValue(requestedCampus);
  const explicitlyRequestedAllCampuses = Object.prototype.hasOwnProperty.call(req.query || {}, "campus")
    && !explicitSelectedCampus;

  if (!globalAdmin && !userCampusKey) {
    return { errorStatus: 403, errorMessage: "Unauthorized: User campus not found." };
  }

  if (!globalAdmin && explicitSelectedCampus && explicitSelectedCampus !== userCampusKey) {
    return {
      authorizedCampus: userCampus,
      effectiveCampus: requestedCampus,
      isGlobalAdmin: false,
      isRestricted: true,
      restrictedCampus: requestedCampus
    };
  }

  return {
    authorizedCampus: userCampus,
    effectiveCampus: globalAdmin || explicitlyRequestedAllCampuses
      ? (explicitSelectedCampus ? requestedCampus : "")
      : userCampus,
    isGlobalAdmin: globalAdmin,
    isRestricted: false,
    restrictedCampus: ""
  };
};

const createRestrictedReportPayload = ({ campus, campusTotal, visibleCampus }) => ({
  records: [],
  meta: {
    restricted: true,
    restrictedCampus: campus,
    campusTotal,
    visibleCampus
  }
});

const getEquipmentInventoryReportRows = async ({ campus = "", laboratory = "", status = "", dateFrom = "", dateTo = "", search = "" } = {}) => {
  const normalizedCampus = normalizeReportFilterValue(campus);
  const campusKey = normalizeReportedCampusValue(normalizedCampus);
  const normalizedLaboratory = normalizeReportFilterValue(laboratory);
  const normalizedStatus = normalizeReportFilterValue(status);
  const normalizedDateFrom = normalizeReportFilterValue(dateFrom);
  const normalizedDateTo = normalizeReportFilterValue(dateTo);
  const normalizedSearch = normalizeReportFilterValue(search);

  const whereClauses = [];
  const replacements = {};

  if (normalizedCampus && normalizedCampus !== "All Campuses" && campusKey) {
    const campusVariants = [...new Set([
      normalizedCampus,
      normalizedCampus.replace(/\s*campus\s*$/i, "").trim(),
      `${normalizedCampus.replace(/\s*campus\s*$/i, "").trim()} Campus`
    ].filter(Boolean))];

    const campusValueSet = campusVariants.map((value) => String(value).trim()).filter(Boolean);
    const campusPlaceholders = campusValueSet.map((_, index) => `:campus_${index}`).join(", ");

    whereClauses.push(`(LOWER(campus) IN (${campusPlaceholders}) OR LOWER(campus) = :campus_key)`);

    campusValueSet.forEach((value, index) => {
      replacements[`campus_${index}`] = String(value).toLowerCase();
    });
    replacements.campus_key = campusKey;
  }

  if (normalizedLaboratory && normalizedLaboratory !== "All Laboratories") {
    whereClauses.push("laboratoryRoom = :laboratory");
    replacements.laboratory = normalizedLaboratory;
  }

  if (normalizedStatus && normalizedStatus !== "All Statuses") {
    whereClauses.push("status = :status");
    replacements.status = normalizedStatus;
  }

  if (normalizedDateFrom) {
    whereClauses.push("dateAdded >= :dateFrom");
    replacements.dateFrom = normalizedDateFrom;
  }

  if (normalizedDateTo) {
    whereClauses.push("dateAdded <= :dateTo");
    replacements.dateTo = normalizedDateTo;
  }

  if (normalizedSearch) {
    whereClauses.push("(equipmentId LIKE :search OR name LIKE :search OR laboratoryRoom LIKE :search OR campus LIKE :search OR category LIKE :search)");
    replacements.search = `%${normalizedSearch}%`;
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const query = `
    SELECT id, equipmentId, assetNumber, name, category, campus, laboratoryRoom, status, quantity, dateAdded, qrCode, qrImage, qrGeneratedAt
    FROM equipment
    ${whereSql}
    ORDER BY dateAdded DESC, id DESC
  `;

  try {
    const rows = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });
    return rows.map((row) => ({
      ...row,
      id: row.id,
      equipmentId: row.equipmentId,
      assetNumber: row.assetNumber,
      name: row.name,
      category: row.category,
      campus: row.campus,
      laboratoryRoom: row.laboratoryRoom,
      status: row.status,
      quantity: row.quantity,
      dateAdded: row.dateAdded
    }));
  } catch (error) {
    console.error("[reports] equipment inventory query failed, falling back to ORM", error);
    const where = {};
    if (normalizedCampus && normalizedCampus !== "All Campuses" && campusKey) {
      const campusVariants = [...new Set([
        normalizedCampus,
        normalizedCampus.replace(/\s*campus\s*$/i, "").trim(),
        `${normalizedCampus.replace(/\s*campus\s*$/i, "").trim()} Campus`
      ].filter(Boolean))];
      where[Op.and] = [{ [Op.or]: campusVariants.map((value) => ({ campus: value })) }];
    }
    if (normalizedLaboratory && normalizedLaboratory !== "All Laboratories") where.laboratoryRoom = normalizedLaboratory;
    if (normalizedStatus && normalizedStatus !== "All Statuses") where.status = normalizedStatus;
    if (normalizedDateFrom || normalizedDateTo) {
      where.dateAdded = {};
      if (normalizedDateFrom) where.dateAdded[Op.gte] = normalizedDateFrom;
      if (normalizedDateTo) where.dateAdded[Op.lte] = normalizedDateTo;
    }
    if (normalizedSearch) {
      where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [
        { equipmentId: { [Op.like]: `%${normalizedSearch}%` } },
        { name: { [Op.like]: `%${normalizedSearch}%` } },
        { laboratoryRoom: { [Op.like]: `%${normalizedSearch}%` } },
        { campus: { [Op.like]: `%${normalizedSearch}%` } },
        { category: { [Op.like]: `%${normalizedSearch}%` } }
      ] }];
    }
    const records = await Equipment.findAll({ where, order: [["dateAdded", "DESC"]] });
    return records.map((record) => record.toJSON());
  }
};

router.get("/api/reports", async (req, res) => {
  try {
    const userCampus = req.session?.userCampus;
    const hasCampusQueryParam = Object.prototype.hasOwnProperty.call(req.query, "campus");
    let requestedCampus = hasCampusQueryParam ? String(req.query.campus ?? "").trim() : "";

    if (requestedCampus && normalizeReportedCampusValue(requestedCampus) === "") {
      requestedCampus = "";
    }

    if (!hasCampusQueryParam && !requestedCampus && userCampus) {
      requestedCampus = userCampus;
    }

    const accessState = await getReportAccessState(req, requestedCampus);
    if (accessState.errorStatus) {
      return res.status(accessState.errorStatus).json({ error: accessState.errorMessage });
    }
    const { reportType = "Equipment Inventory", laboratory = "", status = "", reportPeriod = "all", search = "" } = req.query;
    const incomingDateFrom = req.query.dateFrom || "";
    const incomingDateTo = req.query.dateTo || "";
    const { dateFrom: derivedDateFrom, dateTo: derivedDateTo } = getDateRangeFromReportPeriod(reportPeriod);
    const dateFrom = incomingDateFrom || derivedDateFrom || "";
    const dateTo = incomingDateTo || derivedDateTo || "";
    const searchTerm = search.toString().trim();
    const campus = String(accessState.effectiveCampus || "").trim();

    console.log('[API Report] Type:', reportType, '| Campus:', campus, '| Status:', status, '| Laboratory:', laboratory, '| Restricted:', accessState.isRestricted);

    if (reportType === "Equipment Inventory") {
      const records = await getEquipmentInventoryReportRows({
        campus,
        laboratory,
        status,
        dateFrom,
        dateTo,
        search: searchTerm
      });

      if (accessState.isRestricted) {
        return res.json(createRestrictedReportPayload({
          campus: accessState.restrictedCampus,
          campusTotal: records.length,
          visibleCampus: accessState.authorizedCampus
        }));
      }

      return res.json(records);
    }

    if (reportType === "Borrow Equipment") {
      const where = {};
      const borrowAuthContext = await getUserAuthContext(req);
      const borrowUserCampus = String(borrowAuthContext.campus || "").trim();
      if (!borrowAuthContext.userId) {
        return res.status(401).json({ error: "Please log in to view borrow reports." });
      }
      if (!borrowUserCampus && !accessState.isGlobalAdmin) {
        return res.status(403).json({ error: "User campus is not assigned." });
      }

      if (campus) {
        where.campus = { [Op.in]: getReportCampusVariants(campus) };
      }

      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.borrowDate = {};
        if (dateFrom) where.borrowDate[Op.gte] = dateFrom;
        if (dateTo) where.borrowDate[Op.lte] = dateTo;
      }
      if (searchTerm) {
        where[Op.or] = [
          { borrowerName: { [Op.like]: `%${searchTerm}%` } },
          { equipmentName: { [Op.like]: `%${searchTerm}%` } },
          { borrowerType: { [Op.like]: `%${searchTerm}%` } }
        ];
      }

      try {
        let records = await BorrowRecord.findAll({
          where,
          order: [["borrowDate", "DESC"]]
        });

        try {
          const equipmentIds = [...new Set(records.map(r => r.equipmentId).filter(Boolean))];
          if (equipmentIds.length > 0) {
            const equipmentMap = {};
            const equipmentList = await Equipment.findAll({
              where: { equipmentId: { [Op.in]: equipmentIds } }
            });
            equipmentList.forEach(eq => {
              equipmentMap[eq.equipmentId] = eq;
            });

            records = records.map(record => {
              const eq = equipmentMap[record.equipmentId];
              return {
                ...record.toJSON(),
                campus: record.campus || eq?.campus || "",
                laboratoryRoom: record.laboratoryRoom || eq?.laboratoryRoom || ""
              };
            });
          } else {
            records = records.map(r => r.toJSON());
          }
        } catch (equipmentError) {
          console.warn('[API Report Borrow] Equipment enrichment failed:', equipmentError.message);
          records = records.map(r => r.toJSON());
        }

        let formatted = records;

        if (laboratory) {
          formatted = formatted.filter((item) => item.laboratoryRoom === laboratory);
        }

        if (accessState.isRestricted) {
          return res.json(createRestrictedReportPayload({
            campus: accessState.restrictedCampus,
            campusTotal: formatted.length,
            visibleCampus: accessState.authorizedCampus
          }));
        }

        return res.json(formatted);
      } catch (borrowError) {
        console.error('[Report] Borrow query failed:', borrowError.message);
        return res.status(500).json({ error: borrowError.message });
      }
    }

    if (reportType === "Maintenance") {
      const where = {};
      if (status) where.status = status;
      if (campus) {
        const campusVariants = getReportCampusVariants(campus);
        where[Op.and] = [{
          [Op.or]: [
            { campus: { [Op.in]: campusVariants } },
            { "$equipment.campus$": { [Op.in]: campusVariants } }
          ]
        }];
      }
      if (dateFrom || dateTo) {
        where.dateReported = {};
        if (dateFrom) where.dateReported[Op.gte] = dateFrom;
        if (dateTo) where.dateReported[Op.lte] = dateTo;
      }
      if (searchTerm) {
        where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [
          { issueTitle: { [Op.like]: `%${searchTerm}%` } },
          { description: { [Op.like]: `%${searchTerm}%` } },
          { equipmentId: { [Op.like]: `%${searchTerm}%` } }
        ] }];
      }
      const records = await MaintenanceRequest.findAll({
        where,
        order: [["dateReported", "DESC"]],
        include: [
          {
            model: Equipment,
            as: "equipment",
            attributes: ["equipmentId", "name", "campus", "laboratoryRoom"],
            required: false
          },
          {
            model: User,
            as: "technician",
            attributes: ["id", "name"]
          }
        ]
      });
      let formatted = records.map((record) => {
        const item = record.toJSON();
        return {
          ...item,
          equipmentName: item.equipment?.name || item.equipment_id || "—",
          technicianName: item.technician?.name || "Unassigned",
          dateReported: item.dateReported || item.created_at || item.createdAt || null,
          campus: item.equipment?.campus || item.campus || "",
          laboratoryRoom: item.equipment?.laboratoryRoom || item.laboratory_room || ""
        };
      });
      if (laboratory) {
        formatted = formatted.filter((item) => item.laboratoryRoom === laboratory);
      }

      if (accessState.isRestricted) {
        return res.json(createRestrictedReportPayload({
          campus: accessState.restrictedCampus,
          campusTotal: formatted.length,
          visibleCampus: accessState.authorizedCampus
        }));
      }

      return res.json(formatted);
    }

    if (reportType === "Attendance") {
      const where = {};
      if (campus) {
        const campusSchedules = await LaboratorySchedule.findAll({
          where: { campus: { [Op.in]: getReportCampusVariants(campus) } },
          attributes: ["id"],
          raw: true
        });
        where.laboratoryScheduleId = { [Op.in]: campusSchedules.map((schedule) => schedule.id) };
      }
      if (status) where.status = status;
      if (laboratory) {
        where.lab = laboratory;
      }
      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) where.date[Op.gte] = dateFrom;
        if (dateTo) where.date[Op.lte] = dateTo;
      }
      if (searchTerm) {
        where[Op.or] = [
          { fullName: { [Op.like]: `%${searchTerm}%` } },
          { lab: { [Op.like]: `%${searchTerm}%` } },
          { instructor: { [Op.like]: `%${searchTerm}%` } },
          { studentId: { [Op.like]: `%${searchTerm}%` } }
        ];
      }

      const records = await Attendance.findAll({ where, order: [["date", "DESC"]] });
      const attendanceRows = records.map((record) => record.toJSON());

      if (accessState.isRestricted) {
        return res.json(createRestrictedReportPayload({
          campus: accessState.restrictedCampus,
          campusTotal: attendanceRows.length,
          visibleCampus: accessState.authorizedCampus
        }));
      }

      return res.json(attendanceRows);
    }

    if (reportType === "User Activity") {
      const where = {};
      if (campus) where.campus = { [Op.in]: getReportCampusVariants(campus) };
      if (searchTerm) {
        where[Op.or] = [
          { name: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } },
          { role: { [Op.like]: `%${searchTerm}%` } },
          { student_number: { [Op.like]: `%${searchTerm}%` } }
        ];
      }
      const users = await User.findAll({ where, order: [["createdAt", "DESC"]] });
      let events = [];
      users.forEach((user) => {
        const item = user.toJSON();
        if (item.createdAt) {
          events.push({
            user: item.name,
            role: item.role,
            activity: "Account Created",
            date: item.createdAt.toISOString().slice(0, 10),
            time: item.createdAt.toISOString().slice(11, 16)
          });
        }
        if (item.updatedAt && item.updatedAt > item.createdAt) {
          events.push({
            user: item.name,
            role: item.role,
            activity: "Account Updated",
            date: item.updatedAt.toISOString().slice(0, 10),
            time: item.updatedAt.toISOString().slice(11, 16)
          });
        }
      });
      if (status) {
        events = events.filter((item) => item.activity === status);
      }
      if (dateFrom || dateTo) {
        events = events.filter((item) => {
          const itemDate = new Date(item.date);
          if (dateFrom && itemDate < new Date(dateFrom)) return false;
          if (dateTo && itemDate > new Date(dateTo)) return false;
          return true;
        });
      }

      if (accessState.isRestricted) {
        return res.json(createRestrictedReportPayload({
          campus: accessState.restrictedCampus,
          campusTotal: events.length,
          visibleCampus: accessState.authorizedCampus
        }));
      }

      return res.json(events);
    }

    return res.status(400).json({ error: "Invalid report type." });
  } catch (error) {
    console.error("Failed to load report data:", error);
    res.status(500).json({ error: "Failed to load report data." });
  }
});

router.get("/api/reports-summary", async (req, res) => {
  try {
    const authContext = await getUserAuthContext(req);
    const requestedCampus = String(req.query?.campus || "").trim();
    const accessState = await getReportAccessState(req, requestedCampus);
    if (accessState.errorStatus) return res.status(accessState.errorStatus).json({ error: accessState.errorMessage });
    const selectedCampus = String(accessState.effectiveCampus || "").trim();
    const campusVariants = getReportCampusVariants(selectedCampus);
    const campusFilter = selectedCampus ? { campus: { [Op.in]: campusVariants } } : {};

    const equipmentRows = await Equipment.findAll({
      attributes: ["status"],
      where: campusFilter,
      raw: true
    });
    const statusCounts = equipmentRows.reduce((counts, row) => {
      const status = String(row.status || "").trim().toLowerCase();
      if (status === "serviceable") counts.serviceable += 1;
      if (status === "unserviceable") counts.unserviceable += 1;
      if (status === "lost") counts.lost += 1;
      return counts;
    }, { serviceable: 0, unserviceable: 0, lost: 0 });

    const equipmentTotal = equipmentRows.length;
    const serviceableCount = statusCounts.serviceable;
    const unserviceableCount = statusCounts.unserviceable;
    const lostCount = statusCounts.lost;
    const totalUsers = await User.count({
      where: selectedCampus
        ? { campus: campusFilter.campus }
        : {}
    });
    res.json({
      equipmentTotal,
      serviceableCount,
      unserviceableCount,
      lostCount,
      totalUsers,
      equipmentSummary: `${serviceableCount} serviceable / ${unserviceableCount} unserviceable / ${lostCount} lost`,
      userSummary: `${totalUsers} registered users`,
      unserviceableSummary: `${unserviceableCount} items need maintenance`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load report summary." });
  }
});

router.get("/download/reports-summary", async (req, res) => {
  try {
    const requestedCampus = String(req.query?.campus || "").trim();
    const accessState = await getReportAccessState(req, requestedCampus);
    if (accessState.errorStatus) return res.status(accessState.errorStatus).send(accessState.errorMessage);
    const selectedCampus = String(accessState.effectiveCampus || "").trim();
    const campusFilter = selectedCampus ? { campus: { [Op.in]: getReportCampusVariants(selectedCampus) } } : {};

    const equipmentTotal = await Equipment.count({ where: campusFilter });
    const serviceableCount = await Equipment.count({ where: { ...campusFilter, status: "Serviceable" } });
    const unserviceableCount = await Equipment.count({ where: { ...campusFilter, status: "Unserviceable" } });
    const lostCount = await Equipment.count({ where: { ...campusFilter, status: "Lost" } });
    const totalUsers = await User.count({ where: campusFilter });
    const rows = [
      ["Report Type", "Count", "Summary"],
      ["Equipment Reports", equipmentTotal, `${serviceableCount} serviceable / ${unserviceableCount} unserviceable / ${lostCount} lost`],
      ["Registered Users", totalUsers, `${totalUsers} registered users`],
      ["Maintenance Reports", unserviceableCount, `${unserviceableCount} items need maintenance`]
    ];
    const csv = rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="comlab_reports_summary.csv"');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to generate report CSV.');
  }
});

export default router;
