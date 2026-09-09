import { Op } from "sequelize";
import { Equipment } from "../models/equipmentModel.js";
import { BorrowRecord } from "../models/borrowRecordModel.js";
import { User } from "../models/userModel.js";
import { getUserAuthContext, isAdminRole, isTechnicianRole } from "./campusAuthController.js";

function getCampusVariants(campus) {
  const normalizedCampus = String(campus || "").trim();
  const campusName = normalizedCampus.replace(/\s*Campus\s*$/i, "").trim();
  return [...new Set([normalizedCampus, campusName, `${campusName} Campus`].filter(Boolean))];
}

function parseRecordDate(record, dateField, timeField, fallbackTime) {
  const date = record?.[dateField];
  if (!date) return null;
  const time = String(record?.[timeField] || fallbackTime).slice(0, 5);
  const parsed = new Date(`${String(date).slice(0, 10)}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isValidBorrowRecord(record) {
  return String(record?.status || "").trim().toLowerCase() !== "rejected";
}

function isCurrentlyBorrowed(record, now = new Date()) {
  const status = String(record?.status || "").trim().toLowerCase();
  if (status !== "approved" && status !== "borrowed") return false;

  const start = parseRecordDate(record, "borrowDate", "borrowStartTime", "00:00");
  const end = parseRecordDate(record, "expectedReturnDate", "expectedReturnTime", "23:59");
  if (!start || !end) return status === "borrowed";
  return start <= now && now <= end;
}

function toDateValue(value) {
  return value ? String(value).slice(0, 10) : null;
}

function buildHistoryResponse(record) {
  const item = record.toJSON ? record.toJSON() : record;
  return {
    id: item.id,
    borrowerName: item.borrowerName,
    borrowerType: item.borrowerType,
    equipmentId: item.equipmentId,
    equipmentName: item.equipmentName,
    borrowDate: toDateValue(item.borrowDate),
    borrowStartTime: item.borrowStartTime || null,
    expectedReturnDate: toDateValue(item.expectedReturnDate),
    expectedReturnTime: item.expectedReturnTime || null,
    returnDate: toDateValue(item.returnDate),
    returnTime: null,
    status: item.status,
    condition: item.condition || null,
    purpose: item.purpose || null,
    remarks: item.remarks || null,
    campus: item.campus || null
  };
}

async function getAdminCampusScope(req, res) {
  const context = await getUserAuthContext(req);
  if (!context.userId) {
    res.status(401).json({ error: "Please log in to view equipment availability." });
    return null;
  }

  const user = await User.findByPk(context.userId, { attributes: ["role", "campus"] });
  if (!user) {
    res.status(401).json({ error: "Authenticated user was not found." });
    return null;
  }

  const userCampus = String(user.campus || "").trim();
  if (!isAdminRole(user.role) && !isTechnicianRole(user.role)) {
    res.status(403).json({ error: "Admin or technician access is required." });
    return null;
  }
  if (!userCampus) {
    res.status(403).json({ error: "User campus is not assigned." });
    return null;
  }
  return {
    campus: userCampus,
    campusVariants: getCampusVariants(userCampus)
  };
}

export const listEquipmentAvailability = async (req, res) => {
  try {
    const scope = await getAdminCampusScope(req, res);
    if (!scope) return;

    const [equipment, borrowRecords] = await Promise.all([
      Equipment.findAll({
        where: { campus: { [Op.in]: scope.campusVariants } },
        order: [["name", "ASC"], ["equipmentId", "ASC"]]
      }),
      BorrowRecord.findAll({
        where: { campus: { [Op.in]: scope.campusVariants } },
        order: [["borrowDate", "DESC"], ["created_at", "DESC"]]
      })
    ]);

    const validRecords = borrowRecords.filter(isValidBorrowRecord);
    const now = new Date();
    const response = equipment.map((item) => {
      const itemRecords = validRecords.filter((record) => record.equipmentId === item.equipmentId);
      const status = String(item.status || "Serviceable");
      const unavailable = status.toLowerCase() === "unserviceable" || status.toLowerCase() === "lost";
      const currentlyBorrowed = !unavailable && itemRecords.some((record) => isCurrentlyBorrowed(record, now));
      return {
        equipmentId: item.equipmentId,
        name: item.name,
        category: item.category,
        laboratoryRoom: item.laboratoryRoom || null,
        campus: item.campus,
        status,
        availability: unavailable ? "UNAVAILABLE" : currentlyBorrowed ? "BORROWED" : "AVAILABLE",
        timesBorrowed: itemRecords.length
      };
    });

    res.json(response);
  } catch (error) {
    console.error("Failed to load equipment availability.", error);
    res.status(500).json({ error: "Failed to load equipment availability." });
  }
};

export const getEquipmentBorrowingHistory = async (req, res) => {
  try {
    const scope = await getAdminCampusScope(req, res);
    if (!scope) return;

    const equipment = await Equipment.findOne({
      where: {
        equipmentId: req.params.equipmentId,
        campus: { [Op.in]: scope.campusVariants }
      }
    });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found in your campus." });
    }

    const records = await BorrowRecord.findAll({
      where: {
        equipmentId: equipment.equipmentId,
        campus: { [Op.in]: scope.campusVariants }
      },
      order: [["borrowDate", "DESC"], ["created_at", "DESC"]]
    });
    const history = records.filter(isValidBorrowRecord).map(buildHistoryResponse);
    const now = new Date();
    const returned = history.filter((record) => String(record.status || "").toLowerCase() === "returned").length;
    const lost = history.filter((record) => String(record.status || "").toLowerCase() === "pending replacement" || String(record.condition || "").toLowerCase() === "lost").length;
    const overdue = history.filter((record) => {
      const status = String(record.status || "").toLowerCase();
      if (status === "returned" || status === "pending replacement") return false;
      const due = parseRecordDate(record, "expectedReturnDate", "expectedReturnTime", "23:59");
      return due && due < now;
    }).length;

    res.json({
      equipment: {
        equipmentId: equipment.equipmentId,
        name: equipment.name,
        laboratoryRoom: equipment.laboratoryRoom || null,
        status: equipment.status,
        campus: equipment.campus
      },
      summary: { totalBorrowed: history.length, returned, overdue, lost },
      history
    });
  } catch (error) {
    console.error("Failed to load equipment borrowing history.", error);
    res.status(500).json({ error: "Failed to load equipment borrowing history." });
  }
};
