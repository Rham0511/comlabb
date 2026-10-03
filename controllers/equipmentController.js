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

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import QRCode from "qrcode";
import { Op } from "sequelize";
import { Equipment, EquipmentSequence, EquipmentCategory, sequelize } from "../models/equipmentModel.js";
import { User } from "../models/userModel.js";
import { logAuditEntry } from "./auditController.js";
import {
  getUserAuthContext,
  getUserCampusFromSession,
  canManageRecord,
  isAdminRole,
  isTechnicianRole,
  normalizeRoleName
} from "./campusAuthController.js";

function buildEquipmentQrUrl(equipmentId) {
  const baseUrl = process.env.BASE_URL?.trim();
  if (!baseUrl) {
    console.warn("[equipment] BASE_URL is not configured. Set BASE_URL to your server address such as http://192.168.1.8:3000 so QR codes work on mobile devices.");
    return `/equipment/view/${encodeURIComponent(equipmentId)}`;
  }

  return `${baseUrl.replace(/\/+$/, "")}/equipment/view/${encodeURIComponent(equipmentId)}`;
}

function isEquipmentQrUrl(value) {
  return typeof value === "string" && /^(https?:\/\/|\/equipment\/view\/)/i.test(value);
}

async function generateQrImage(payload) {
  return QRCode.toDataURL(payload, {
    type: "image/png",
    width: 1200,
    margin: 4,
    errorCorrectionLevel: "H",
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });
}

const defaultCategories = [
  { name: "Computer", prefix: "CMP" },
  { name: "CPU", prefix: "CPU" },
  { name: "Monitor", prefix: "MON" },
  { name: "Keyboard", prefix: "KEY" },
  { name: "Mouse", prefix: "MOU" },
  { name: "Chair", prefix: "CHR" },
  { name: "Table", prefix: "TBL" },
  { name: "Printer", prefix: "PRN" },
  { name: "Projector", prefix: "PRJ" },
  { name: "Scanner", prefix: "SCN" },
  { name: "Speaker", prefix: "SPK" },
  { name: "Webcam", prefix: "WBC" },
  { name: "Microphone", prefix: "MIC" },
  { name: "Router", prefix: "RTR" },
  { name: "Switch", prefix: "SWT" },
  { name: "Access Point", prefix: "ACP" },
  { name: "HDMI Cable", prefix: "HDM" },
  { name: "LAN Cable", prefix: "LNC" },
  { name: "Extension Cord", prefix: "EXT" },
  { name: "UPS", prefix: "UPS" },
  { name: "AVR", prefix: "AVR" },
  { name: "Cabinet", prefix: "CBT" },
  { name: "Whiteboard", prefix: "WBD" },
  { name: "Electric Fan", prefix: "FAN" },
  { name: "Air Conditioner", prefix: "AC" },
  { name: "Fire Extinguisher", prefix: "FEX" },
  { name: "Other", prefix: "OTH" }
];

async function seedDefaultCategories() {
  for (const category of defaultCategories) {
    try {
      const existing = await EquipmentCategory.findOne({ where: { name: category.name } });
      if (existing) {
        if (existing.prefix !== category.prefix) {
          const prefixConflict = await EquipmentCategory.findOne({ where: { prefix: category.prefix } });
          if (!prefixConflict || prefixConflict.name === category.name) {
            await existing.update({ prefix: category.prefix });
          }
        }
        continue;
      }

      const duplicatePrefix = await EquipmentCategory.findOne({ where: { prefix: category.prefix } });
      if (duplicatePrefix) {
        continue;
      }

      await EquipmentCategory.create({ name: category.name, prefix: category.prefix });
    } catch (err) {
      // Silently skip duplicate entries
      if (err.name === 'SequelizeUniqueConstraintError') {
        continue;
      }
      throw err;
    }
  }
}

async function getCategoryPrefix(category, transaction) {
  if (!category || typeof category !== "string") {
    return "OTH";
  }

  const normalizedName = category.trim();
  if (!normalizedName) {
    return "OTH";
  }

  const record = await EquipmentCategory.findOne({
    where: { name: normalizedName },
    transaction
  });

  if (record && record.prefix) {
    return record.prefix.toUpperCase();
  }

  return normalizedName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "OTH";
}

async function generateEquipmentId(category, campus) {
  return await sequelize.transaction(async (transaction) => {
    const campusName = String(campus || "").trim().replace(/\s*Campus\s*$/i, "").trim();
    const campusVariants = [campusName, `${campusName} Campus`];
    const campusWidth = {
      victoria: 2,
      bongabong: 3,
      calapan: 4
    }[campusName.toLowerCase()] || 3;
    const prefix = await getCategoryPrefix(category, transaction);
    const sequenceKey = `${campusName.toLowerCase()}:${prefix}`;
    const [sequence] = await EquipmentSequence.findOrCreate({
      where: { prefix: sequenceKey },
      defaults: { lastNumber: 0 },
      transaction
    });

    const existingEquipment = await Equipment.findAll({
      where: {
        campus: { [Op.in]: campusVariants },
        category,
        equipmentId: {
          [Op.like]: `${prefix}-%`
        }
      },
      attributes: ["equipmentId"],
      transaction
    });
    const highestExisting = existingEquipment.reduce((max, row) => {
      const match = row.equipmentId.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    if (highestExisting > Number(sequence.lastNumber || 0)) {
      sequence.lastNumber = highestExisting;
    }

    const nextNumber = sequence.lastNumber + 1;
    sequence.lastNumber = nextNumber;
    await sequence.save({ transaction });

    return `${prefix}-${String(nextNumber).padStart(campusWidth, "0")}`;
  });
}

function getCanonicalCampusName(campus) {
  const campusName = String(campus || "").trim().replace(/\s*Campus\s*$/i, "").trim();
  return campusName ? `${campusName} Campus` : "";
}

function getCampusVariants(campus) {
  const normalizedCampus = String(campus || "").trim();
  const campusName = normalizedCampus.replace(/\s*Campus\s*$/i, "").trim();
  return [...new Set([normalizedCampus, campusName, `${campusName} Campus`].filter(Boolean))];
}

await Equipment.sync();
await EquipmentSequence.sync();
await EquipmentCategory.sync();
await seedDefaultCategories();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(import.meta.url);

async function findEquipmentByIdentifier(identifier, req = null) {
  if (identifier === undefined || identifier === null) {
    return null;
  }

  const normalized = String(identifier).trim();
  if (!normalized) {
    return null;
  }

  const authContext = req ? await getUserAuthContext(req) : null;
  const campusVariants = authContext?.campus ? getCampusVariants(authContext.campus) : [];
  const campusWhere = campusVariants.length ? { campus: { [Op.in]: campusVariants } } : null;
  const numericId = Number(normalized);
  if (Number.isInteger(numericId)) {
    const byPk = await Equipment.findOne({
      where: { id: numericId, ...(campusWhere || {}) }
    });
    if (byPk) {
      return byPk;
    }
  }

  const matches = await Equipment.findAll({
    where: { equipmentId: normalized, ...(campusWhere || {}) },
    limit: 2
  });
  return matches.length === 1 ? matches[0] : null;
}

export const inventoryPage = async (req, res) => {
  try {
    const authContext = await getUserAuthContext(req);
    if (!authContext.userId) {
      return res.redirect("/login");
    }

    const normalizedRole = normalizeRoleName(authContext.role);
    const canViewInventoryPage = isAdminRole(normalizedRole) ||
      isTechnicianRole(normalizedRole) ||
      normalizedRole === "instructor";
    if (!canViewInventoryPage) {
      return res.status(403).send("Forbidden: admin or technician access required.");
    }

    const currentUserId = req.session?.userId;
    let currentUser = null;

    if (currentUserId) {
      const user = await User.findByPk(currentUserId, {
        attributes: ["name", "email", "role", "campus", "photo"]
      });

      if (user) {
        const userName = user.name || "Administrator";
        const initials = userName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("") || "AD";

        currentUser = {
          id: currentUserId,
          name: userName,
          email: user.email || "",
          role: user.role || "admin",
          campus: user.campus || null,
          photo: user.photo || null,
          initials
        };
      }
    }

    const filePath = path.join(process.cwd(), "equipment-inventory.html");
    const html = await fs.promises.readFile(filePath, "utf8");
    const hydratedHtml = html
      .replaceAll("__CURRENT_USER_JSON__", JSON.stringify(currentUser))
      .replace("window.__CURRENT_USER__ = __CURRENT_USER_JSON__;", `window.__CURRENT_USER__ = ${JSON.stringify(currentUser)};`);

    res.type("html").send(hydratedHtml);
  } catch (error) {
    console.error("Failed to serve equipment inventory page:", error);
    res.status(500).send("Failed to load equipment inventory page.");
  }
};

export const viewEquipmentPage = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const equipment = await findEquipmentByIdentifier(equipmentId, req);

    if (!equipment) {
      return res.status(404).send(`<!DOCTYPE html><html><body><h1>Equipment not found</h1></body></html>`);
    }

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).send("You do not have permission to view equipment from another campus.");
    }

    const formattedDate = equipment.dateAdded
      ? new Date(equipment.dateAdded).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "Not Available";

    const equipmentName = String(equipment.name || "Equipment").trim() || "Equipment";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${equipmentName}</title>
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
    .page-shell {
      width: min(100%, 720px);
      border: 2px solid rgba(6, 78, 59, 0.6);
      border-radius: 1.5rem;
      padding: 1.15rem;
      background: rgba(5, 12, 10, 0.82);
      box-shadow: 0 26px 70px rgba(2, 8, 23, 0.46);
      backdrop-filter: blur(16px);
    }
    .card {
      border-radius: 1.2rem;
      background: linear-gradient(145deg, rgba(8, 19, 14, 0.98), rgba(4, 10, 8, 0.96));
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 1.35rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .eyebrow { font-size: 0.74rem; font-weight: 800; letter-spacing: 0.32em; text-transform: uppercase; color: #6ee7b7; }
    .title-row { display: flex; align-items: center; gap: 0.9rem; margin-top: 0.7rem; }
    .icon { width: 2.6rem; height: 2.6rem; border-radius: 999px; display: grid; place-items: center; background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(110, 231, 183, 0.26); color: #d1fae5; flex-shrink: 0; }
    .title { margin: 0; font-size: 1.8rem; color: #a7f3d0; font-weight: 700; letter-spacing: 0.01em; }
    .subtitle { margin-top: 0.25rem; color: rgba(187, 247, 208, 0.92); font-size: 0.95rem; }
    .meta { display: grid; gap: 0; margin-top: 1.05rem; border-radius: 1rem; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(6, 14, 10, 0.7); }
    .row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.92rem 1rem; background: rgba(6, 14, 10, 0.78); border-bottom: 1px solid rgba(16, 185, 129, 0.24); }
    .row:last-child { border-bottom: none; }
    .label { color: #6ee7b7; font-weight: 700; letter-spacing: 0.01em; }
    .value { color: #f5f7f2; font-weight: 600; text-align: right; }
    .status-badge { display: inline-block; padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; }
    .status-serviceable { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
    .status-missing { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .status-maintenance { background: rgba(234,179,8,0.15); color: #fbbf24; border: 1px solid rgba(234,179,8,0.3); }
    .status-unserviceable { background: rgba(107,114,128,0.15); color: #9ca3af; border: 1px solid rgba(107,114,128,0.3); }
    @media (max-width: 640px) { .row { flex-direction: column; align-items: flex-start; } .value { text-align: left; } }
  </style>
</head>
<body>
  <div class="page-shell">
    <div class="card">
      <div class="eyebrow">Equipment Information</div>
      <div class="title-row">
        <div class="icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h16"></path><path d="M7 7v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7"></path><path d="M9 11h6"></path><path d="M9 15h6"></path>
          </svg>
        </div>
        <div>
          <h1 class="title">${equipmentName}</h1>
          <div class="subtitle">Asset record • ${equipment.equipmentId}</div>
        </div>
      </div>
      <div class="meta">
        <div class="row"><span class="label">Equipment ID</span><span class="value">${equipment.equipmentId}</span></div>
        <div class="row"><span class="label">Equipment Name</span><span class="value">${equipmentName}</span></div>
        <div class="row"><span class="label">Serial Number</span><span class="value">${equipment.serialNumber || 'Not Assigned'}</span></div>
        <div class="row"><span class="label">PC Set</span><span class="value">${equipment.setId || 'Not Assigned'}</span></div>
        <div class="row"><span class="label">Category</span><span class="value">${equipment.category || 'N/A'}</span></div>
        <div class="row"><span class="label">Laboratory</span><span class="value">${equipment.laboratoryRoom || 'Not Assigned'}</span></div>
        <div class="row"><span class="label">Location</span><span class="value">${equipment.location || 'Not Specified'}</span></div>
        <div class="row"><span class="label">Campus</span><span class="value">${equipment.campus}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">
          <span class="status-badge ${
            equipment.status === 'Serviceable' ? 'status-serviceable' :
            equipment.status === 'Missing' ? 'status-missing' :
            equipment.status === 'Under Maintenance' ? 'status-maintenance' :
            'status-unserviceable'
          }">${equipment.status}</span>
        </span></div>
        <div class="row"><span class="label">Date Added</span><span class="value">${formattedDate}</span></div>
        ${equipment.status === 'Missing' && equipment.missingReportedAt ? `<div class="row"><span class="label">Reported Missing</span><span class="value" style="color:#f87171;">${new Date(equipment.missingReportedAt).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}</span></div>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;

    res.type("html").send(html);
  } catch (error) {
    console.error("Failed to render equipment info page.", error);
    res.status(500).send("Failed to load equipment information.");
  }
};

export const getEquipment = async (req, res) => {
  const { search = "", status, campus } = req.query;
  try {
    const authContext = await getUserAuthContext(req);
    if (!authContext.userId) {
      return res.status(401).json({ error: "Please log in to view equipment inventory." });
    }

    const normalizedRole = normalizeRoleName(authContext.role);
    const canViewInventory = isAdminRole(normalizedRole) ||
      isTechnicianRole(normalizedRole) ||
      normalizedRole === "instructor";
    if (!canViewInventory) {
      return res.status(403).json({ error: "Admin or technician access is required." });
    }

    const where = {};
    const userCampus = authContext.campus || await getUserCampusFromSession(req);
    const requestedCampus = String(campus || "").trim();
    const isAllCampuses = !requestedCampus || /^all\s+campuses?$/i.test(requestedCampus);

    if (userCampus) {
      // Campus-scoped users receive individual records only from their own campus.
      // Totals for other campuses come from the separate campus-totals endpoint.
      if (!isAllCampuses && !canManageRecord(userCampus, requestedCampus)) {
        where.id = { [Op.eq]: 0 };
      } else {
        const campusTrimmed = String(userCampus).trim();
        const campusName = campusTrimmed.replace(/\s*Campus\s*$/i, "");
        where[Op.or] = [
          { campus: campusTrimmed },
          { campus: campusName },
          { campus: `${campusName} Campus` }
        ];
      }
    } else if (!isAllCampuses) {
      const campusTrimmed = requestedCampus;
      const campusName = campusTrimmed.replace(/\s*Campus\s*$/i, "");
      where[Op.or] = [
        { campus: campusTrimmed },
        { campus: campusName },
        { campus: `${campusName} Campus` }
      ];
    }

    const records = await Equipment.findAll({
      where,
      order: [["dateAdded", "DESC"]]
    });

    const filtered = records
      .map((item) => item.toJSON())
      .filter((item) => {
        const matchesSearch = search
          .toString()
          .toLowerCase()
          .split(" ")
          .every((token) =>
            token === "" ||
            item.equipmentId.toLowerCase().includes(token) ||
            item.name.toLowerCase().includes(token)
          );
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
      });

    res.json(filtered);
  } catch (error) {
    console.error("[equipment] Get equipment error:", error);
    res.status(500).json({ error: "Failed to load equipment." });
  }
};

export const getStudentEquipment = async (req, res) => {
  try {
    const authContext = await getUserAuthContext(req);
    if (!authContext.userId) {
      return res.status(401).json({ error: "Please log in to view available equipment." });
    }

    if (normalizeRoleName(authContext.role) !== "student") {
      return res.status(403).json({ error: "Student access is required." });
    }

    const campusName = String(authContext.campus || "").trim().replace(/\s*Campus\s*$/i, "");
    if (!campusName) {
      return res.status(403).json({ error: "User campus is not assigned." });
    }

    const records = await Equipment.findAll({
      where: {
        campus: {
          [Op.in]: [campusName, `${campusName} Campus`]
        }
      },
      attributes: ["equipmentId", "name", "category", "laboratoryRoom", "status", "quantity"],
      order: [["name", "ASC"], ["equipmentId", "ASC"]]
    });

    return res.json(records);
  } catch (error) {
    console.error("[equipment] Get student equipment error:", error);
    return res.status(500).json({ error: "Failed to load available equipment." });
  }
};

export const getEquipmentCampusTotals = async (req, res) => {
  try {
    const authContext = await getUserAuthContext(req);
    if (!authContext.userId) {
      return res.status(401).json({ error: "Please log in to view equipment campus totals." });
    }

    const normalizedRole = normalizeRoleName(authContext.role);
    const canViewTotals = isAdminRole(normalizedRole) ||
      isTechnicianRole(normalizedRole) ||
      normalizedRole === "instructor";
    if (!canViewTotals) {
      return res.status(403).json({ error: "Admin or technician access is required." });
    }

    const userCampus = authContext.campus || null;
    const campusName = String(userCampus || "").trim().replace(/\s*Campus\s*$/i, "");
    if (isTechnicianRole(normalizedRole) && !campusName) {
      return res.status(403).json({ error: "User campus is not assigned." });
    }

    const where = isTechnicianRole(normalizedRole)
      ? {
          campus: {
            [Op.in]: [campusName, `${campusName} Campus`]
          }
        }
      : {};

    const rows = await Equipment.findAll({
      where,
      attributes: [
        "campus",
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'Serviceable' THEN 1 ELSE 0 END")), "serviceable"],
        [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'Unserviceable' THEN 1 ELSE 0 END")), "unserviceable"],
        [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'Lost' THEN 1 ELSE 0 END")), "lost"]
      ],
      group: ["campus"],
      raw: true
    });

    const campusCounts = {};
    const allCampuses = { total: 0, Serviceable: 0, Unserviceable: 0, Lost: 0 };

    for (const row of rows) {
      const campusName = String(row.campus || "").trim();
      if (!campusName) continue;

      const summary = {
        total: Number(row.total || 0),
        Serviceable: Number(row.serviceable || 0),
        Unserviceable: Number(row.unserviceable || 0),
        Lost: Number(row.lost || 0)
      };

      campusCounts[campusName] = summary;
      allCampuses.total += summary.total;
      allCampuses.Serviceable += summary.Serviceable;
      allCampuses.Unserviceable += summary.Unserviceable;
      allCampuses.Lost += summary.Lost;
    }

    res.json({
      userCampus: userCampus || null,
      campusCounts,
      allCampuses
    });
  } catch (error) {
    console.error("[equipment] Get campus totals error:", error);
    res.status(500).json({ error: "Failed to load equipment campus totals." });
  }
};

export const getEquipmentQr = async (req, res) => {
  const { id } = req.params;
  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found." });
    }

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to view equipment from another campus." });
    }

    let qrCode = equipment.qrCode;
    let qrImage = equipment.qrImage;
    let qrGeneratedAt = equipment.qrGeneratedAt;

    const shouldRefreshQr = !qrCode || !qrImage || !isEquipmentQrUrl(qrCode);

    if (shouldRefreshQr) {
      const payload = buildEquipmentQrUrl(equipment.equipmentId);
      qrCode = payload;
      qrImage = await generateQrImage(payload);
      qrGeneratedAt = new Date();
      await equipment.update({ qrCode, qrImage, qrGeneratedAt });
    }

    res.json({
      equipment: {
        ...equipment.toJSON(),
        serialNumber: equipment.serialNumber || null,
        setId: equipment.setId || null,
        location: equipment.location || null
      },
      qrCode, qrImage, qrGeneratedAt
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load equipment QR." });
  }
};

export const createEquipment = async (req, res) => {
  const { assetNumber = "", name, campus: requestedCampus, laboratoryRoom, status, serialNumber, setId, manufacturer, model, purchaseDate, warrantyExpiry, condition, location, remarks } = req.body;
  const sessionRole = String(req.session?.userRole || "").toLowerCase();
  const nextStatus = sessionRole === "technician" ? (status || "Serviceable") : "Serviceable";
  if (!name) {
    return res.status(400).json({ error: "Equipment name is required." });
  }

  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(403).json({ error: "Unauthorized: Not authenticated." });
    }

    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) {
      return res.status(403).json({ error: "Unauthorized: Your account does not have a campus assigned. Contact administrator." });
    }

    if (requestedCampus && !canManageRecord(userCampus, requestedCampus)) {
      return res.status(403).json({ error: "You do not have permission to create equipment for this campus." });
    }

    // --- SERIAL NUMBER UNIQUENESS VALIDATION ---
    if (serialNumber && String(serialNumber).trim()) {
      const trimmedSN = String(serialNumber).trim();
      const snConflict = await Equipment.findOne({ where: { serialNumber: trimmedSN } });
      if (snConflict) {
        return res.status(409).json({
          error: `Serial number '${trimmedSN}' already exists. Each equipment must have a unique serial number.`,
          conflict: { equipmentId: snConflict.equipmentId, name: snConflict.name, campus: snConflict.campus }
        });
      }
    }

    // --- PC SET VALIDATION ---
    if (setId && String(setId).trim()) {
      const trimmedSetId = String(setId).trim();
      const [setRows] = await (await import('mysql2/promise')).createPool({
        host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'comlab',
        password: process.env.DB_PASSWORD || 'comlab123', database: process.env.DB_NAME || 'comlab'
      }).query('SELECT id FROM equipment_sets WHERE setId = ? LIMIT 1', [trimmedSetId]);
      if (!setRows.length) {
        return res.status(404).json({ error: `Target PC Set '${trimmedSetId}' does not exist.` });
      }
    }

    const campus = getCanonicalCampusName(userCampus);
    const equipmentId = await generateEquipmentId(name, campus);
    const existing = await Equipment.findOne({
      where: { campus: { [Op.in]: [campus, campus.replace(/\s*Campus\s*$/i, "")] }, category: name, equipmentId }
    });
    if (existing) {
      return res.status(409).json({ error: "Generated Equipment ID already exists. Please try again." });
    }

    const dateAdded = new Date();
    const qrCode = buildEquipmentQrUrl(equipmentId);
    const qrImage = await generateQrImage(qrCode);
    const qrGeneratedAt = new Date();

    const equipment = await Equipment.create({
      equipmentId, assetNumber, name, category: name, campus, laboratoryRoom,
      status: nextStatus, dateAdded, qrCode, qrImage, qrGeneratedAt,
      serialNumber: serialNumber ? String(serialNumber).trim() : null,
      setId: setId ? String(setId).trim() : null,
      manufacturer: manufacturer || null, model: model || null,
      purchaseDate: purchaseDate || null, warrantyExpiry: warrantyExpiry || null,
      condition: condition || 'good', location: location || null, remarks: remarks || null
    });

    await logAuditEntry(req, {
      action: "Equipment Created",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${equipment.name}) was added to ${campus} campus.${equipment.serialNumber ? ` SN: ${equipment.serialNumber}.` : ''}${equipment.setId ? ` Set: ${equipment.setId}.` : ''}`
    });

    // Recalculate set status if assigned to a set
    if (equipment.setId) {
      await recalculateSetStatus(equipment.setId);
    }

    res.status(201).json(equipment);
  } catch (error) {
    console.error("[equipment] Create error:", error);
    if (error.name === "SequelizeUniqueConstraintError" && error.fields?.serialNumber) {
      return res.status(409).json({ error: "Serial number already exists. Each equipment must have a unique serial number." });
    }
    res.status(500).json({ error: "Failed to add equipment." });
  }
};

export const updateEquipment = async (req, res) => {
  const { id } = req.params;
  const { assetNumber = "", name, campus, laboratoryRoom, status, serialNumber, manufacturer, model, purchaseDate, warrantyExpiry, condition, location, remarks } = req.body;
  if (!name || !campus) {
    return res.status(400).json({ error: "Equipment name and campus are required." });
  }

  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found." });
    }

    const sessionRole = String(req.session?.userRole || "").toLowerCase();
    const requestedStatus = typeof status === "string" ? status.trim() : "";

    // Block status changes to Missing/Under Maintenance through this generic update endpoint
    // Those have dedicated endpoints: /report-missing and maintenance workflow
    if (requestedStatus && ["Missing", "Under Maintenance"].includes(requestedStatus)) {
      return res.status(400).json({ error: `Use the dedicated endpoint to mark equipment as '${requestedStatus}'.` });
    }

    if (requestedStatus && requestedStatus !== equipment.status && sessionRole !== "technician" && !isAdminRole(sessionRole)) {
      return res.status(403).json({ error: "Only technicians or admins may update equipment status." });
    }

    const userId = req.session?.userId;
    if (!userId) {
      return res.status(403).json({ error: "Unauthorized: Not authenticated." });
    }

    const userCampus = await getUserCampusFromSession(req);
    const equipmentCampus = equipment.campus;
    if (!userCampus || !canManageRecord(userCampus, equipmentCampus)) {
      return res.status(403).json({ error: "You do not have permission to modify equipment from another campus." });
    }
    if (!canManageRecord(userCampus, campus)) {
      return res.status(403).json({ error: "You do not have permission to assign equipment to another campus." });
    }

    // --- SERIAL NUMBER UNIQUENESS VALIDATION ---
    if (serialNumber !== undefined) {
      const trimmedSN = serialNumber ? String(serialNumber).trim() : null;
      if (trimmedSN) {
        const snConflict = await Equipment.findOne({
          where: { serialNumber: trimmedSN, id: { [Op.ne]: equipment.id } }
        });
        if (snConflict) {
          return res.status(409).json({
            error: `Serial number '${trimmedSN}' already exists on equipment ${snConflict.equipmentId} (${snConflict.name}).`,
            conflict: { equipmentId: snConflict.equipmentId, name: snConflict.name, campus: snConflict.campus }
          });
        }
      }
    }

    const oldCampus = equipment.campus;
    const nextStatus = requestedStatus || equipment.status || "Serviceable";
    const updateData = {
      assetNumber, name, campus, laboratoryRoom, status: nextStatus,
      manufacturer: manufacturer !== undefined ? manufacturer || null : equipment.manufacturer,
      model: model !== undefined ? model || null : equipment.model,
      purchaseDate: purchaseDate !== undefined ? purchaseDate || null : equipment.purchaseDate,
      warrantyExpiry: warrantyExpiry !== undefined ? warrantyExpiry || null : equipment.warrantyExpiry,
      condition: condition !== undefined ? condition || equipment.condition : equipment.condition,
      location: location !== undefined ? location || null : equipment.location,
      remarks: remarks !== undefined ? remarks || null : equipment.remarks,
    };
    if (serialNumber !== undefined) {
      updateData.serialNumber = serialNumber ? String(serialNumber).trim() : null;
    }
    await equipment.update(updateData);

    const campusChange = oldCampus !== campus ? ` (moved from ${oldCampus})` : "";
    await logAuditEntry(req, {
      action: "Equipment Updated",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${name}) was updated${campusChange}.${updateData.serialNumber ? ` SN: ${updateData.serialNumber}.` : ''}`
    });

    res.json(equipment);
  } catch (error) {
    console.error("[equipment] Update error:", error);
    if (error.name === "SequelizeUniqueConstraintError" && error.fields?.serialNumber) {
      return res.status(409).json({ error: "Serial number already exists. Each equipment must have a unique serial number." });
    }
    res.status(500).json({ error: "Failed to update equipment." });
  }
};

export const updateEquipmentStatus = async (req, res) => {
  const { id } = req.params;
  const requestedStatus = String(req.body?.status || "").trim();
  // Missing and Under Maintenance have their own dedicated endpoints
  const validStatuses = ["Serviceable", "Unserviceable", "Lost"];

  if (!validStatuses.includes(requestedStatus)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}. Use /report-missing or the maintenance workflow for other statuses.` });
  }

  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found." });
    }

    const sessionRole = String(req.session?.userRole || "").toLowerCase();
    if (sessionRole !== "technician") {
      return res.status(403).json({ error: "Only technicians may update equipment condition status." });
    }

    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus || !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to manage equipment in this campus." });
    }

    const previousStatus = equipment.status;
    await equipment.update({ status: requestedStatus });

    // Recalculate set status if part of a set
    if (equipment.setId) {
      await recalculateSetStatus(equipment.setId);
    }

    await logAuditEntry(req, {
      action: "Equipment Status Updated",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${equipment.name}) was marked ${requestedStatus} by the technician.`,
      details: {
        equipmentId: equipment.equipmentId,
        campus: equipment.campus,
        previousStatus,
        newStatus: requestedStatus
      }
    });

    return res.json({
      success: true,
      equipment,
      status: requestedStatus,
      previousStatus
    });
  } catch (error) {
    console.error("[equipment] Update status error:", error);
    return res.status(500).json({ error: "Failed to update equipment status." });
  }
};

export const deleteEquipment = async (req, res) => {
  const { id } = req.params;
  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found." });
    }

    // Get authenticated user's context
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(403).json({ error: "Unauthorized: Not authenticated." });
    }

    // Get user's campus from session/database
    const userCampus = await getUserCampusFromSession(req);
    const equipmentCampus = equipment.campus;

    // Authorization rules:
    // 1. User with campus must match equipment's campus
    // 2. User without campus (legacy) can manage any equipment
    // 3. Both must have appropriate role (checked via middleware elsewhere)
    if (!userCampus || !canManageRecord(userCampus, equipmentCampus)) {
      return res.status(403).json({
        error: "Unauthorized: You can only manage equipment belonging to your campus."
      });
    }

    const equipmentData = equipment.toJSON();
    const removed = await Equipment.destroy({ where: { id: equipment.id } });
    if (!removed) {
      return res.status(404).json({ error: "Equipment not found." });
    }
    await logAuditEntry(req, {
      action: "Equipment Deleted",
      module: "Equipment Inventory",
      resourceId: equipmentData.equipmentId,
      description: `Equipment ${equipmentData.equipmentId} (${equipmentData.name}) was deleted.`,
      details: equipmentData
    });
    res.json({ success: true });
  } catch (error) {
    console.error("[equipment] Delete error:", error);
    res.status(500).json({ error: "Failed to delete equipment." });
  }
};

export const getEquipmentCategories = async (req, res) => {
  try {
    const categories = await EquipmentCategory.findAll({ order: [["name", "ASC"]] });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to load categories." });
  }
};

export const createEquipmentCategory = async (req, res) => {
  const { name, prefix } = req.body;
  if (!name || !prefix) {
    return res.status(400).json({ error: "Category name and prefix are required." });
  }

  const trimmedName = String(name).trim();
  const trimmedPrefix = String(prefix).trim().toUpperCase();

  if (!trimmedName || !trimmedPrefix) {
    return res.status(400).json({ error: "Category name and prefix cannot be empty." });
  }

  try {
    const existingName = await EquipmentCategory.findOne({ where: { name: trimmedName } });
    if (existingName) {
      return res.status(409).json({ error: "Category name already exists." });
    }

    const existingPrefix = await EquipmentCategory.findOne({ where: { prefix: trimmedPrefix } });
    if (existingPrefix) {
      return res.status(409).json({ error: "Prefix already exists." });
    }

    const category = await EquipmentCategory.create({ name: trimmedName, prefix: trimmedPrefix });
    res.status(201).json(category);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Category name or prefix already exists." });
    }
    res.status(500).json({ error: "Failed to create category." });
  }
};

export const deleteEquipmentCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await EquipmentCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    const inUseCount = await Equipment.count({ where: { category: category.name } });
    if (inUseCount > 0) {
      return res.status(409).json({ error: "Cannot delete category while it is used by equipment." });
    }

    await category.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category." });
  }
};

// ============================================================
// EQUIPMENT INVENTORY ENHANCEMENTS — Phase 2
// ============================================================
import { MissingEquipmentHistory } from "../models/missingEquipmentHistoryModel.js";

/**
 * Shared helper: recalculate and persist a PC Set's status
 * based on the current condition of all its components.
 * Rules:
 *   - Any component is "Missing"        → incomplete
 *   - Any component is "Under Maintenance" → maintenance
 *   - Any component is "Unserviceable"  → incomplete
 *   - All components Serviceable + has CPU+Monitor → active
 *   - Has components but missing essentials → incomplete
 *   - No components → incomplete
 */
export async function recalculateSetStatus(setId) {
  if (!setId) return;
  try {
    const components = await Equipment.findAll({
      where: { setId },
      attributes: ["category", "status"]
    });

    if (!components.length) {
      await sequelize.query(
        "UPDATE equipment_sets SET status = 'incomplete', updatedAt = NOW() WHERE setId = ?",
        { replacements: [setId] }
      );
      return;
    }

    const statuses = components.map(c => String(c.status || "").toLowerCase());
    const categories = components.map(c => String(c.category || "").toLowerCase());

    let newStatus = "active";

    if (statuses.some(s => s === "missing")) {
      newStatus = "incomplete";
    } else if (statuses.some(s => s === "under maintenance")) {
      newStatus = "maintenance";
    } else if (statuses.some(s => s === "unserviceable")) {
      newStatus = "incomplete";
    } else {
      // All serviceable — check essentials
      const hasCpu = categories.some(c => c === "cpu" || c === "computer" || c === "system unit");
      const hasMonitor = categories.some(c => c === "monitor");
      if (!hasCpu || !hasMonitor) newStatus = "incomplete";
    }

    await sequelize.query(
      "UPDATE equipment_sets SET status = ?, updatedAt = NOW() WHERE setId = ?",
      { replacements: [newStatus, setId] }
    );
  } catch (err) {
    console.warn(`[equipment] recalculateSetStatus failed for ${setId}:`, err.message);
  }
}

// ---- TASK 5: REPORT MISSING ----
export const reportEquipmentMissing = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "A reason or notes are required when reporting equipment as missing." });
  }

  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) return res.status(404).json({ error: "Equipment not found." });

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to manage equipment from another campus." });
    }

    if (equipment.status === "Missing") {
      return res.status(409).json({ error: "Equipment is already marked as Missing." });
    }

    const userId = req.session?.userId || null;
    const user = userId ? await User.findByPk(userId, { attributes: ["name"] }) : null;
    const userName = user?.name || "Unknown User";
    const now = new Date();

    // Preserve setId — do NOT clear it
    const originalSetId = equipment.setId;

    // Update equipment status — keep setId unchanged
    await equipment.update({
      status: "Missing",
      missingReportedAt: now,
      missingReportedBy: userId,
      missingReason: String(reason).trim(),
      foundAt: null,
      foundBy: null
    });

    // Create missing history record
    await MissingEquipmentHistory.create({
      equipmentId: equipment.id,
      equipmentCode: equipment.equipmentId,
      serialNumber: equipment.serialNumber || null,
      setId: originalSetId || null,
      campus: equipment.campus,
      laboratoryRoom: equipment.laboratoryRoom || null,
      location: equipment.location || null,
      eventType: "reported_missing",
      reportedBy: userId,
      reportedByName: userName,
      reportedAt: now,
      reason: String(reason).trim()
    });

    // Audit log
    await logAuditEntry(req, {
      action: "Equipment Reported Missing",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${equipment.name}) reported as Missing by ${userName}.${equipment.serialNumber ? ` SN: ${equipment.serialNumber}.` : ''}${originalSetId ? ` Original Set: ${originalSetId}.` : ''} Reason: ${String(reason).trim()}`
    });

    // Recalculate set status (set becomes incomplete)
    if (originalSetId) {
      await recalculateSetStatus(originalSetId);
    }

    return res.json({
      success: true,
      message: "Equipment has been marked as Missing.",
      equipment: {
        id: equipment.id,
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        serialNumber: equipment.serialNumber,
        setId: equipment.setId,  // setId preserved
        status: "Missing",
        missingReportedAt: now,
        campus: equipment.campus
      }
    });
  } catch (error) {
    console.error("[equipment] reportMissing error:", error);
    return res.status(500).json({ error: "Failed to report equipment as missing." });
  }
};

// ---- TASK 6: MARK AS FOUND ----
export const markEquipmentFound = async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) return res.status(404).json({ error: "Equipment not found." });

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to manage equipment from another campus." });
    }

    if (equipment.status !== "Missing") {
      return res.status(409).json({
        error: `Equipment cannot be marked as Found because it is not currently Missing. Current status: ${equipment.status}.`
      });
    }

    const userId = req.session?.userId || null;
    const user = userId ? await User.findByPk(userId, { attributes: ["name"] }) : null;
    const userName = user?.name || "Unknown User";
    const now = new Date();
    const originalSetId = equipment.setId;

    // Restore to Serviceable — keep equipmentId, serialNumber, setId all unchanged
    await equipment.update({
      status: "Serviceable",
      foundAt: now,
      foundBy: userId
    });

    // Create found history record
    await MissingEquipmentHistory.create({
      equipmentId: equipment.id,
      equipmentCode: equipment.equipmentId,
      serialNumber: equipment.serialNumber || null,
      setId: originalSetId || null,
      campus: equipment.campus,
      laboratoryRoom: equipment.laboratoryRoom || null,
      location: equipment.location || null,
      eventType: "found",
      reportedBy: userId,
      reportedByName: userName,
      reportedAt: now,
      reason: notes ? String(notes).trim() : null,
      resolvedAt: now,
      resolvedBy: userId,
      resolvedByName: userName
    });

    await logAuditEntry(req, {
      action: "Equipment Marked Found",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${equipment.name}) marked as Found by ${userName}.${equipment.serialNumber ? ` SN: ${equipment.serialNumber}.` : ''}${originalSetId ? ` Restored to Set: ${originalSetId}.` : ''}`
    });

    // Recalculate set status (may become active again)
    if (originalSetId) {
      await recalculateSetStatus(originalSetId);
    }

    return res.json({
      success: true,
      message: "Equipment has been marked as Found and restored to Serviceable.",
      equipment: {
        id: equipment.id,
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        serialNumber: equipment.serialNumber,
        setId: equipment.setId,  // setId unchanged
        status: "Serviceable",
        foundAt: now,
        campus: equipment.campus
      }
    });
  } catch (error) {
    console.error("[equipment] markFound error:", error);
    return res.status(500).json({ error: "Failed to mark equipment as found." });
  }
};

// ---- TASK 7: TRANSFER EQUIPMENT BETWEEN SETS ----
export const transferEquipmentSet = async (req, res) => {
  const { id } = req.params;
  const { targetSetId, reason } = req.body;

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "A reason is required for transferring equipment between sets." });
  }

  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) return res.status(404).json({ error: "Equipment not found." });

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to manage equipment from another campus." });
    }

    // Block transfer of Missing equipment
    if (equipment.status === "Missing") {
      return res.status(409).json({
        error: "Cannot transfer Missing equipment. Mark it as Found first before transferring to another set."
      });
    }

    const oldSetId = equipment.setId || null;
    const newSetId = targetSetId ? String(targetSetId).trim() : null;

    if (oldSetId === newSetId) {
      return res.status(409).json({ error: "Equipment is already assigned to this set." });
    }

    // Validate target set exists
    if (newSetId) {
      const [setRows] = await sequelize.query(
        "SELECT id, setName FROM equipment_sets WHERE setId = ? LIMIT 1",
        { replacements: [newSetId], type: "SELECT" }
      );
      if (!setRows) {
        return res.status(404).json({ error: `Target PC Set '${newSetId}' does not exist.` });
      }
    }

    const userId = req.session?.userId || null;
    const user = userId ? await User.findByPk(userId, { attributes: ["name"] }) : null;
    const userName = user?.name || "Unknown User";
    const now = new Date();

    // Update the setId
    await equipment.update({ setId: newSetId });

    // Create transfer history record
    await MissingEquipmentHistory.create({
      equipmentId: equipment.id,
      equipmentCode: equipment.equipmentId,
      serialNumber: equipment.serialNumber || null,
      setId: newSetId || null,
      campus: equipment.campus,
      laboratoryRoom: equipment.laboratoryRoom || null,
      location: equipment.location || null,
      eventType: "transferred",
      reportedBy: userId,
      reportedByName: userName,
      reportedAt: now,
      reason: `Transferred from Set: ${oldSetId || 'None'} → ${newSetId || 'None'}. ${String(reason).trim()}`,
      notes: `Previous Set: ${oldSetId || 'None'}`
    });

    await logAuditEntry(req, {
      action: "Equipment Set Transfer",
      module: "Equipment Inventory",
      resourceId: equipment.equipmentId,
      description: `Equipment ${equipment.equipmentId} (${equipment.name}) transferred from Set ${oldSetId || 'None'} to ${newSetId || 'None'} by ${userName}. Reason: ${String(reason).trim()}`
    });

    // Recalculate both old and new set statuses
    if (oldSetId) await recalculateSetStatus(oldSetId);
    if (newSetId) await recalculateSetStatus(newSetId);

    return res.json({
      success: true,
      message: `Equipment transferred from ${oldSetId || 'No Set'} to ${newSetId || 'No Set'}.`,
      equipment: {
        id: equipment.id,
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        serialNumber: equipment.serialNumber,
        setId: newSetId,
        previousSetId: oldSetId,
        status: equipment.status,
        campus: equipment.campus
      }
    });
  } catch (error) {
    console.error("[equipment] transferSet error:", error);
    return res.status(500).json({ error: "Failed to transfer equipment to target set." });
  }
};

// ---- TASK 8A: GET ALL MISSING EQUIPMENT ----
export const getMissingEquipment = async (req, res) => {
  try {
    const userCampus = await getUserCampusFromSession(req);
    if (!userCampus) return res.status(403).json({ error: "User campus is not assigned." });

    const campusVariants = getCampusVariants(userCampus);
    const missing = await Equipment.findAll({
      where: {
        status: "Missing",
        campus: { [Op.in]: campusVariants }
      },
      order: [["missingReportedAt", "DESC"]]
    });

    // Enrich with reporter name
    const userIds = [...new Set(missing.map(e => e.missingReportedBy).filter(Boolean))];
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "name"] })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const result = missing.map(e => ({
      id: e.id,
      equipmentId: e.equipmentId,
      name: e.name,
      category: e.category,
      serialNumber: e.serialNumber || null,
      setId: e.setId || null,
      campus: e.campus,
      laboratoryRoom: e.laboratoryRoom || null,
      location: e.location || null,
      status: e.status,
      missingReportedAt: e.missingReportedAt,
      missingReportedBy: e.missingReportedBy,
      missingReportedByName: userMap.get(e.missingReportedBy) || null,
      missingReason: e.missingReason || null
    }));

    return res.json(result);
  } catch (error) {
    console.error("[equipment] getMissingEquipment error:", error);
    return res.status(500).json({ error: "Failed to load missing equipment." });
  }
};

// ---- TASK 8B: GET EQUIPMENT HISTORY (missing/found/transfer events) ----
export const getEquipmentHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const equipment = await findEquipmentByIdentifier(id, req);
    if (!equipment) return res.status(404).json({ error: "Equipment not found." });

    const userCampus = await getUserCampusFromSession(req);
    if (userCampus && !canManageRecord(userCampus, equipment.campus)) {
      return res.status(403).json({ error: "You do not have permission to view this equipment." });
    }

    const history = await MissingEquipmentHistory.findAll({
      where: { equipmentId: equipment.id },
      order: [["reportedAt", "DESC"]]
    });

    return res.json({
      equipment: {
        id: equipment.id,
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        category: equipment.category,
        serialNumber: equipment.serialNumber || null,
        setId: equipment.setId || null,
        campus: equipment.campus,
        status: equipment.status,
        missingReportedAt: equipment.missingReportedAt || null,
        missingReportedBy: equipment.missingReportedBy || null,
        missingReason: equipment.missingReason || null,
        foundAt: equipment.foundAt || null
      },
      history
    });
  } catch (error) {
    console.error("[equipment] getEquipmentHistory error:", error);
    return res.status(500).json({ error: "Failed to load equipment history." });
  }
};
