import { Op } from "sequelize";
import { BorrowHistory, BorrowRecord } from "../models/borrowRecordModel.js";
import { Equipment } from "../models/equipmentModel.js";
import { User } from "../models/userModel.js";
import { MaintenanceRequest } from "../models/maintenanceRequestModel.js";
import { logAuditEntry } from "./auditController.js";
import { getUserAuthContext, isAdminRole, isTechnicianRole, canManageRecord } from "./campusAuthController.js";

function getCampusVariants(campus) {
  const normalizedCampus = String(campus || "").trim();
  const campusName = normalizedCampus.replace(/\s*Campus\s*$/i, "").trim();
  return [...new Set([
    normalizedCampus,
    campusName,
    `${campusName} Campus`
  ].filter(Boolean))];
}

function isCentralAdministrator(authContext) {
  return isAdminRole(authContext?.role) && !String(authContext?.campus || "").trim();
}

async function getBorrowAccessScope(req) {
  const authContext = await getUserAuthContext(req);
  if (!authContext.userId) {
    return { authenticated: false, centralAdministrator: false, campus: null, where: null };
  }

  const campus = String(authContext.campus || "").trim() || null;
  return {
    authenticated: true,
    userId: authContext.userId,
    role: authContext.role,
    centralAdministrator: isAdminRole(authContext.role) && !campus,
    campus,
    where: campus ? { campus: { [Op.in]: getCampusVariants(campus) } } : null
  };
}

function canAccessBorrowRecord(scope, recordCampus) {
  return Boolean(scope.campus) &&
    Boolean(String(recordCampus || "").trim()) &&
    canManageRecord(scope.campus, recordCampus);
}

function getStrictBorrowWhere(scope) {
  if (!scope.campus) return null;
  return { campus: { [Op.in]: getCampusVariants(scope.campus) } };
}

function toMinutes(timeString = "00:00") {
  if (!timeString || typeof timeString !== "string") return 0;
  const [hourPart, minutePart] = timeString.split(":");
  const hours = Number(hourPart || 0);
  const minutes = Number(minutePart || 0);
  return hours * 60 + minutes;
}

function normalizeBorrowStatus(status) {
  const value = String(status || "").trim();
  if (!value) return "Pending";
  const lower = value.toLowerCase();
  if (lower === "approved") return "Approved";
  if (lower === "rejected") return "Rejected";
  if (lower === "returned") return "Returned";
  if (lower === "pending") return "Pending";
  if (lower === "borrowed") return "Borrowed";
  return value;
}

function parseDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const trimmedDate = String(dateValue).slice(0, 10);
  const trimmedTime = String(timeValue || "00:00").slice(0, 5);
  const parsed = new Date(`${trimmedDate}T${trimmedTime}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBorrowRecordEffectiveStatus(record) {
  const rawStatus = String(record?.status || "").trim();
  const lowerStatus = rawStatus.toLowerCase();

  if (["rejected", "returned", "lost", "pending replacement"].includes(lowerStatus)) {
    return rawStatus || "Returned";
  }

  if (["pending", "approved", "borrowed"].includes(lowerStatus)) {
    const expectedReturn = parseDateTime(record?.expectedReturnDate || record?.borrowDate, record?.expectedReturnTime || "23:59");
    if (expectedReturn && expectedReturn < new Date()) {
      return "Overdue";
    }
    return rawStatus === "Approved" ? "Approved" : (rawStatus === "Pending" ? "Pending" : "Borrowed");
  }

  if (!rawStatus) return "Borrowed";
  return rawStatus;
}

function hasTimeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
}

function isUnavailableForBorrowing(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return normalizedStatus === "unserviceable" || normalizedStatus === "lost";
}

export const listBorrowNotifications = async (req, res) => {
  const scope = await getBorrowAccessScope(req);
  if (!scope.authenticated) return res.status(401).json({ error: "Please log in to view borrow notifications." });
  const strictWhere = getStrictBorrowWhere(scope);
  if (!strictWhere) return res.status(403).json({ error: "User campus is not assigned." });
  const records = await BorrowRecord.findAll({
    where: { ...strictWhere, status: "Pending" },
    order: [["created_at", "DESC"]],
    limit: 50
  });
  return res.json(records.map((record) => ({
    id: `borrow-${record.id}`,
    type: "borrow_request",
    title: "New Borrow Request",
    message: `${record.borrowerName} requested to borrow ${record.equipmentId} - ${record.equipmentName}.`,
    relatedId: record.id,
    campus: record.campus,
    readAt: null
  })));
};

export const markBorrowNotificationRead = async (req, res) => {
  const scope = await getBorrowAccessScope(req);
  if (!scope.authenticated) return res.status(401).json({ error: "Please log in to update notifications." });
  return res.json({ success: true });
};

function buildBorrowResponse(record) {
  const item = record.toJSON ? record.toJSON() : record;
  const effectiveStatus = getBorrowRecordEffectiveStatus(item);
  return {
    ...item,
    effectiveStatus,
    status: item.status || "Borrowed",
    borrowDate: item.borrowDate ? item.borrowDate.toString() : null,
    borrowStartTime: item.borrowStartTime || null,
    expectedReturnDate: item.expectedReturnDate ? item.expectedReturnDate.toString() : null,
    expectedReturnTime: item.expectedReturnTime || null,
    returnDate: item.returnDate ? item.returnDate.toString() : null,
    createdAt: item.created_at ? item.created_at.toISOString() : null,
    updatedAt: item.updated_at ? item.updated_at.toISOString() : null
  };
}

export const listBorrowRecords = async (req, res) => {
  try {
    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated) return res.status(401).json({ error: "Please log in to view borrow records." });
    const strictWhere = getStrictBorrowWhere(scope);
    if (!strictWhere) return res.status(403).json({ error: "User campus is not assigned." });

    const records = await BorrowRecord.findAll({
      where: strictWhere,
      order: [["created_at", "DESC"]]
    });

    let visibleRecords = records;
    if (String(scope.role || "").toLowerCase() === "student") {
      const student = await User.findByPk(scope.userId, { attributes: ["name"] });
      visibleRecords = records.filter((record) => String(record.borrowerName || "").trim() === String(student?.name || "").trim());
    }

    const response = visibleRecords
      .map(buildBorrowResponse)
      .sort((left, right) => {
        const leftTime = new Date(left.created_at || left.createdAt || left.borrowDate || 0).getTime();
        const rightTime = new Date(right.created_at || right.createdAt || right.borrowDate || 0).getTime();
        return rightTime - leftTime;
      });

    res.json(response);
  } catch (error) {
    console.error("Failed to load borrow records.", error);
    res.status(500).json({ error: "Failed to load borrow records." });
  }
};

export const createBorrowRecord = async (req, res) => {
  const scope = await getBorrowAccessScope(req);
  if (!scope.authenticated) return res.status(401).json({ error: "Please log in to create a borrow request." });
  if (!scope.where) return res.status(403).json({ error: "User campus is not assigned." });

  let {
    id,
    borrowerName,
    borrowerType,
    departmentInfo,
    instructorName,
    instructor_name,
    equipmentType,
    laboratoryRoom,
    equipmentId,
    equipmentName,
    quantity,
    borrowDate,
    borrowStartTime,
    expectedReturnDate,
    expectedReturnTime,
    purpose,
    processedBy
  } = req.body;

  const sessionUserId = req.session?.userId;
  if (sessionUserId) {
    const sessionUser = await User.findByPk(sessionUserId);
    if (sessionUser) {
      borrowerName = borrowerName || sessionUser.name;
      borrowerType = borrowerType || "Student";
      departmentInfo = departmentInfo || [sessionUser.program, sessionUser.year, sessionUser.section].filter(Boolean).join(" • ");
    }
  }

  if (!borrowerName || !equipmentId || !borrowDate || !expectedReturnDate || !borrowStartTime || !expectedReturnTime) {
    return res.status(400).json({ error: "Borrower name, equipment, borrow date, start time, end time, and return date are required." });
  }

  equipmentId = String(equipmentId).trim();

  const requestedStart = toMinutes(String(borrowStartTime).slice(0, 5));
  const requestedEnd = toMinutes(String(expectedReturnTime).slice(0, 5));
  if (requestedEnd <= requestedStart) {
    return res.status(400).json({ error: "End time must be later than start time." });
  }

  const normalizedBorrowDate = String(borrowDate).slice(0, 10);
  const normalizedExpectedReturnDate = String(expectedReturnDate).slice(0, 10);
  const requestStartDate = parseDateTime(normalizedBorrowDate, borrowStartTime);
  const requestEndDate = parseDateTime(normalizedExpectedReturnDate, expectedReturnTime);

  if (!requestStartDate || !requestEndDate || requestEndDate <= requestStartDate) {
    return res.status(400).json({ error: "The requested borrowing time range is invalid." });
  }

  try {
    const equipmentWhere = { equipmentId };
    if (!scope.centralAdministrator) {
      equipmentWhere.campus = { [Op.in]: getCampusVariants(scope.campus) };
    }
    const equipment = await Equipment.findOne({ where: equipmentWhere });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found in your campus." });
    }
    equipmentId = equipment.equipmentId;
    equipmentName = equipment.name;

    const normalizedEquipmentType = String(equipmentType || '').trim().toLowerCase();
    const equipmentCategory = String(equipment.category || '').trim().toLowerCase();
    const equipmentNameValue = String(equipment.name || '').trim().toLowerCase();
    if (equipmentType && normalizedEquipmentType !== equipmentCategory && normalizedEquipmentType !== equipmentNameValue) {
      return res.status(400).json({ error: "Selected equipment type does not match the equipment record." });
    }

    if (laboratoryRoom && String(laboratoryRoom).trim() !== String(equipment.laboratoryRoom || '').trim()) {
      return res.status(400).json({ error: "Selected laboratory does not match the equipment record." });
    }

    if (isUnavailableForBorrowing(equipment.status)) {
      return res.status(400).json({ error: `${equipment.status} equipment is not available for borrowing.` });
    }

    const duplicateRequest = await BorrowRecord.findOne({
      where: {
        borrowerName,
        equipmentId,
        borrowDate: normalizedBorrowDate,
        borrowStartTime: String(borrowStartTime).slice(0, 5),
        expectedReturnDate: normalizedExpectedReturnDate,
        expectedReturnTime: String(expectedReturnTime).slice(0, 5),
        purpose: purpose ? String(purpose).trim() : null,
        campus: { [Op.in]: getCampusVariants(String(equipment.campus || "").trim()) },
        status: { [Op.in]: ["Pending", "Approved", "Borrowed"] }
      }
    });

    if (duplicateRequest) {
      return res.status(200).json(buildBorrowResponse(duplicateRequest));
    }

    const equipmentCampus = String(equipment.campus || "").trim();
    if (!equipmentCampus) {
      return res.status(400).json({ error: "Equipment is not associated with a campus." });
    }

    const requestedQty = Number(quantity || 1);
    const totalInventory = Number(equipment.quantity ?? equipment.availableQuantity ?? 0);
    if (requestedQty < 1 || requestedQty > totalInventory) {
      return res.status(400).json({ error: "Requested quantity exceeds available inventory." });
    }

    const activeBorrowRecords = await BorrowRecord.findAll({
      where: {
        equipmentId,
        campus: { [Op.in]: getCampusVariants(equipmentCampus) },
        status: { [Op.in]: ["Approved", "Borrowed"] }
      }
    });

    let reservedQty = 0;
    for (const record of activeBorrowRecords) {
      const recordStart = parseDateTime(record.borrowDate, record.borrowStartTime || "00:00");
      const recordEnd = parseDateTime(record.expectedReturnDate || record.borrowDate, record.expectedReturnTime || "23:59");
      if (!recordStart || !recordEnd) continue;
      if (hasTimeOverlap(requestStartDate, requestEndDate, recordStart, recordEnd)) {
        reservedQty += Number(record.quantity || 1);
      }
    }

    if (reservedQty + requestedQty > totalInventory) {
      return res.status(400).json({ error: "This equipment is not available for the selected time. Please choose another equipment or schedule." });
    }

    const recordId = id || `borrow-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const record = await BorrowRecord.create({
      id: recordId,
      borrowerName,
      borrowerType: borrowerType || "Student",
      departmentInfo,
      instructorName: instructorName || instructor_name || null,
      equipmentId,
      equipmentName: equipment.name,
      quantity: requestedQty,
      borrowDate: normalizedBorrowDate,
      borrowStartTime: String(borrowStartTime).slice(0, 5),
      expectedReturnDate: normalizedExpectedReturnDate,
      expectedReturnTime: String(expectedReturnTime).slice(0, 5),
      campus: equipmentCampus,
      purpose,
      status: "Pending",
      processedBy: processedBy || "Admin"
    });

    await BorrowHistory.create({
      recordId: record.id,
      borrowerName,
      equipmentId,
      equipmentName: equipment.name,
      borrowDate: normalizedBorrowDate,
      borrowStartTime: record.borrowStartTime,
      expectedReturnTime: record.expectedReturnTime,
      purpose,
      remarks: "Borrow request submitted and pending admin approval",
      processedBy: processedBy || "Admin",
      eventType: "pending"
    });

    const campusUsers = await User.findAll({
      where: {
        campus: { [Op.in]: getCampusVariants(equipmentCampus) }
      },
      attributes: ["id", "role"]
    });
    const technicians = campusUsers.filter((user) => isTechnicianRole(user.role));

    await logAuditEntry(req, {
      action: "Borrow Request Submitted",
      module: "Borrow Management",
      resourceId: record.id,
      description: `${borrowerName} submitted a pending borrow request for ${requestedQty}x ${equipmentName} (${equipmentId}).`,
      details: {
        borrowRecordId: record.id,
        equipmentId,
        equipmentName,
        borrowerName,
        instructorName: instructorName || instructor_name || null,
        quantity: requestedQty,
        borrowDate: normalizedBorrowDate,
        borrowStartTime: String(borrowStartTime).slice(0, 5),
        expectedReturnDate: normalizedExpectedReturnDate,
        expectedReturnTime: String(expectedReturnTime).slice(0, 5),
        status: "Pending"
      }
    });

    res.status(201).json(buildBorrowResponse(record));
  } catch (error) {
    console.error("Failed to create borrow record.", error);
    res.status(500).json({ error: `Failed to create borrow record: ${error.message}` });
  }
};

export const approveBorrowRecord = async (req, res) => {
  const { id } = req.params;
  const { processedBy = "Technician" } = req.body;

  try {
    const record = await BorrowRecord.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: "Borrow record not found." });
    }

    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated || (!isTechnicianRole(scope.role) && !isAdminRole(scope.role)) || !canAccessBorrowRecord(scope, record.campus)) {
      return res.status(403).json({ error: "You do not have permission to approve borrow records from another campus." });
    }

    if (String(record.status || "").trim().toLowerCase() !== "pending") {
      return res.status(409).json({ error: "This borrow request has already been processed." });
    }

    const equipment = await Equipment.findOne({
      where: {
        equipmentId: record.equipmentId,
        campus: { [Op.in]: getCampusVariants(record.campus) }
      }
    });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found in the borrow record's campus." });
    }
    if (String(equipment.name || "") !== String(record.equipmentName || "")) {
      return res.status(409).json({ error: "Equipment is no longer available for borrowing." });
    }
    if (isUnavailableForBorrowing(equipment.status)) {
      return res.status(409).json({ error: "Equipment is no longer available for borrowing." });
    }

    const activeRecords = await BorrowRecord.findAll({
      where: {
        equipmentId: record.equipmentId,
        campus: { [Op.in]: getCampusVariants(record.campus) },
        status: { [Op.in]: ["Approved", "Borrowed"] }
      }
    });
    const overlappingQuantity = activeRecords.reduce((total, activeRecord) => {
      const activeStart = parseDateTime(activeRecord.borrowDate, activeRecord.borrowStartTime || "00:00");
      const activeEnd = parseDateTime(activeRecord.expectedReturnDate || activeRecord.borrowDate, activeRecord.expectedReturnTime || "23:59");
      return activeStart && activeEnd && hasTimeOverlap(
        parseDateTime(record.borrowDate, record.borrowStartTime || "00:00"),
        parseDateTime(record.expectedReturnDate || record.borrowDate, record.expectedReturnTime || "23:59"),
        activeStart,
        activeEnd
      ) ? total + Number(activeRecord.quantity || 1) : total;
    }, 0);
    if (overlappingQuantity + Number(record.quantity || 1) > Number(equipment.quantity || 0)) {
      return res.status(409).json({ error: "Equipment is no longer available for borrowing." });
    }

    const [updatedCount] = await BorrowRecord.update({
      status: "Approved",
      processedBy: processedBy || record.processedBy || "Admin"
    }, { where: { id, status: "Pending" } });
    if (!updatedCount) return res.status(409).json({ error: "This borrow request has already been processed." });
    const updated = await BorrowRecord.findByPk(id);

    await BorrowHistory.create({
      recordId: updated.id,
      borrowerName: updated.borrowerName,
      equipmentId: updated.equipmentId,
      equipmentName: updated.equipmentName,
      borrowDate: updated.borrowDate,
      borrowStartTime: updated.borrowStartTime,
      expectedReturnTime: updated.expectedReturnTime,
      purpose: updated.purpose,
      remarks: "Borrow request approved by technician",
      processedBy: updated.processedBy,
      eventType: "approved"
    });

    await logAuditEntry(req, {
      action: "BORROW_REQUEST_APPROVED",
      module: "Borrow Management",
      resourceId: updated.id,
      description: `Borrow request ${updated.id} for ${updated.equipmentId} was approved for ${updated.borrowerName}. Status: Approved.`
    });

    res.json(buildBorrowResponse(updated));
  } catch (error) {
    console.error("Failed to approve borrow request.", error);
    res.status(500).json({ error: "Failed to approve borrow request." });
  }
};

export const rejectBorrowRecord = async (req, res) => {
  const { id } = req.params;
  const { processedBy = "Technician", reason = "" } = req.body;

  try {
    const record = await BorrowRecord.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: "Borrow record not found." });
    }

    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated || (!isTechnicianRole(scope.role) && !isAdminRole(scope.role)) || !canAccessBorrowRecord(scope, record.campus)) {
      return res.status(403).json({ error: "You do not have permission to reject borrow records from another campus." });
    }

    if (String(record.status || "").trim().toLowerCase() !== "pending") {
      return res.status(409).json({ error: "This borrow request has already been processed." });
    }

    const [updatedCount] = await BorrowRecord.update({
      status: "Rejected",
      remarks: String(reason || "").trim() || null,
      processedBy: processedBy || record.processedBy || "Technician"
    }, { where: { id, status: "Pending" } });
    if (!updatedCount) return res.status(409).json({ error: "This borrow request has already been processed." });
    const updated = await BorrowRecord.findByPk(id);

    await BorrowHistory.create({
      recordId: updated.id,
      borrowerName: updated.borrowerName,
      equipmentId: updated.equipmentId,
      equipmentName: updated.equipmentName,
      borrowDate: updated.borrowDate,
      borrowStartTime: updated.borrowStartTime,
      expectedReturnTime: updated.expectedReturnTime,
      purpose: updated.purpose,
      remarks: String(reason || "").trim() || "Borrow request rejected by technician",
      processedBy: updated.processedBy,
      eventType: "rejected"
    });

    await logAuditEntry(req, {
      action: "BORROW_REQUEST_REJECTED",
      module: "Borrow Management",
      resourceId: updated.id,
      description: `Borrow request ${updated.id} for ${updated.equipmentId} was rejected for ${updated.borrowerName}. Reason: ${String(reason || "No reason provided").trim()}.`
    });

    res.json(buildBorrowResponse(updated));
  } catch (error) {
    console.error("Failed to reject borrow request.", error);
    res.status(500).json({ error: "Failed to reject borrow request." });
  }
};

export const returnBorrowRecord = async (req, res) => {
  const { id } = req.params;
  const { condition = "Good", remarks = "", processedBy = "Admin" } = req.body;

  try {
    const record = await BorrowRecord.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: "Borrow record not found." });
    }

    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated || !canAccessBorrowRecord(scope, record.campus)) {
      return res.status(403).json({ error: "You do not have permission to process returns for another campus." });
    }

    const updated = await record.update({
      status: condition === "Damaged" ? "Returned" : condition === "Lost" ? "Pending Replacement" : "Returned",
      returnDate: new Date().toISOString().split("T")[0],
      condition,
      remarks,
      processedBy
    });

    await BorrowHistory.create({
      recordId: updated.id,
      borrowerName: updated.borrowerName,
      equipmentId: updated.equipmentId,
      equipmentName: updated.equipmentName,
      borrowDate: updated.borrowDate,
      borrowStartTime: updated.borrowStartTime,
      returnDate: updated.returnDate,
      expectedReturnTime: updated.expectedReturnTime,
      condition: updated.condition,
      purpose: updated.purpose,
      remarks: updated.remarks,
      processedBy: updated.processedBy,
      eventType: "returned"
    });

    if (condition === "Damaged" || condition === 'Minor Damage') {
      await MaintenanceRequest.create({
        equipmentId: updated.equipmentId,
        equipmentName: updated.equipmentName,
        issueTitle: `Equipment returned damaged: ${updated.equipmentName}`,
        description: remarks || `Equipment returned in damaged condition during borrow record ${updated.id}`,
        category: "Equipment Damage",
        priority: condition === 'Damaged' ? "High" : "Low",
        status: "Pending",
        campus: record.campus,
        dateReported: new Date(),
        reportedBy: null
      });
    }

    res.json(buildBorrowResponse(updated));
  } catch (error) {
    console.error("Failed to update borrow return.", error);
    res.status(500).json({ error: "Failed to update borrow return." });
  }
};

export const markBorrowRecordLost = async (req, res) => {
  const { id } = req.params;
  const { processedBy = "Technician" } = req.body;

  try {
    const record = await BorrowRecord.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: "Borrow record not found." });
    }

    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated || !isTechnicianRole(scope.role) || !canAccessBorrowRecord(scope, record.campus)) {
      return res.status(403).json({ error: "Only technicians for this campus can mark equipment as lost." });
    }

    const effectiveStatus = getBorrowRecordEffectiveStatus(record.toJSON ? record.toJSON() : record);
    if (effectiveStatus !== "Overdue") {
      return res.status(409).json({ error: "Only overdue equipment can be marked as lost." });
    }

    const equipment = await Equipment.findOne({
      where: {
        equipmentId: record.equipmentId,
        campus: { [Op.in]: getCampusVariants(record.campus) }
      }
    });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment record was not found in this campus." });
    }

    const [updatedCount] = await BorrowRecord.update({
      status: "Lost",
      remarks: String(record.remarks || "").trim() || "Marked lost by technician after overdue confirmation.",
      processedBy: processedBy || record.processedBy || "Technician"
    }, { where: { id, status: { [Op.in]: ["Approved", "Borrowed"] } } });
    if (!updatedCount) {
      return res.status(409).json({ error: "This equipment is already no longer active for loss marking." });
    }

    await Equipment.update({ status: "Lost" }, {
      where: {
        equipmentId: record.equipmentId,
        campus: { [Op.in]: getCampusVariants(record.campus) }
      }
    });

    const updated = await BorrowRecord.findByPk(id);
    await BorrowHistory.create({
      recordId: updated.id,
      borrowerName: updated.borrowerName,
      equipmentId: updated.equipmentId,
      equipmentName: updated.equipmentName,
      borrowDate: updated.borrowDate,
      borrowStartTime: updated.borrowStartTime,
      returnDate: updated.returnDate,
      expectedReturnTime: updated.expectedReturnTime,
      condition: updated.condition,
      purpose: updated.purpose,
      remarks: "Marked as lost by technician after overdue confirmation.",
      processedBy: updated.processedBy,
      eventType: "lost"
    });

    await logAuditEntry(req, {
      action: "Marked Equipment as Lost",
      module: "Borrow Management",
      resourceId: updated.id,
      description: `Technician marked ${updated.equipmentId} (${updated.equipmentName}) as Lost for borrower ${updated.borrowerName} in ${updated.campus}.`,
      actorName: String(processedBy || req?.session?.userName || "Technician").trim() || "Technician",
      actorRole: "Technician"
    });

    res.json(buildBorrowResponse(updated));
  } catch (error) {
    console.error("Failed to mark borrow record as lost.", error);
    res.status(500).json({ error: "Failed to mark equipment as lost." });
  }
};

export const getBorrowHistory = async (req, res) => {
  const { id } = req.params;

  try {
    const scope = await getBorrowAccessScope(req);
    if (!scope.authenticated) return res.status(401).json({ error: "Please log in to view borrow history." });
    const strictWhere = getStrictBorrowWhere(scope);
    if (!strictWhere) return res.status(403).json({ error: "User campus is not assigned." });

    const record = await BorrowRecord.findOne({ where: { id, ...strictWhere } });
    if (!record) return res.status(404).json({ error: "Borrow record not found." });

    const history = await BorrowHistory.findAll({ where: { recordId: id }, order: [["created_at", "ASC"]] });
    res.json(history.map((entry) => entry.toJSON()));
  } catch (error) {
    console.error("Failed to load borrow history.", error);
    res.status(500).json({ error: "Failed to load borrow history." });
  }
};
