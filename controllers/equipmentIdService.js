import { Op } from "sequelize";
import { Equipment, EquipmentCategory } from "../models/equipmentModel.js";

function normalizeCampus(value) {
  return String(value || "").trim();
}

function getCampusVariants(campus) {
  const normalizedCampus = normalizeCampus(campus);
  const campusName = normalizedCampus.replace(/\s*Campus\s*$/i, "").trim();
  return [...new Set([normalizedCampus, campusName, `${campusName} Campus`].filter(Boolean))];
}

function normalizeEquipmentType(value) {
  return String(value || "").trim();
}

function buildTypeMatchClause(equipmentType) {
  const trimmedType = normalizeEquipmentType(equipmentType);
  if (!trimmedType) {
    return null;
  }

  return {
    [Op.or]: [
      { category: trimmedType },
      { name: trimmedType }
    ]
  };
}

export async function resolveEquipmentTypePrefix(equipmentType, transaction) {
  const trimmedType = normalizeEquipmentType(equipmentType);
  if (!trimmedType) {
    return "OTH";
  }

  const category = await EquipmentCategory.findOne({
    where: { name: trimmedType },
    transaction
  });

  if (category?.prefix) {
    return category.prefix.toUpperCase();
  }

  return trimmedType.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "OTH";
}

export async function generateEquipmentIdForCampusType({ campus, equipmentType, transaction }) {
  const campusName = normalizeCampus(campus);
  const trimmedType = normalizeEquipmentType(equipmentType);
  const prefix = await resolveEquipmentTypePrefix(trimmedType, transaction);
  const typeMatchClause = buildTypeMatchClause(trimmedType);
  const campusNameWithoutSuffix = campusName.replace(/\s*Campus\s*$/i, "").trim();
  const campusWidth = {
    victoria: 2,
    bongabong: 3,
    calapan: 4
  }[campusNameWithoutSuffix.toLowerCase()] || 3;

  if (!campusName || !trimmedType) {
    return `${prefix}-${String(1).padStart(campusWidth, "0")}`;
  }

  const existingEquipment = await Equipment.findAll({
    where: {
      campus: { [Op.in]: getCampusVariants(campusName) },
      equipmentId: {
        [Op.like]: `${prefix}-%`
      },
      ...(typeMatchClause || {})
    },
    attributes: ["equipmentId"],
    transaction
  });

  const highestExisting = existingEquipment.reduce((max, row) => {
    const match = row.equipmentId?.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) {
      return max;
    }

    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  const nextNumber = highestExisting + 1;
  return `${prefix}-${String(nextNumber).padStart(campusWidth, "0")}`;
}

export async function findEquipmentByCampusAndType({ campus, equipmentType, equipmentId, transaction }) {
  const campusName = normalizeCampus(campus);
  const trimmedType = normalizeEquipmentType(equipmentType);
  const trimmedEquipmentId = String(equipmentId || "").trim();
  const typeMatchClause = buildTypeMatchClause(trimmedType);

  if (!campusName || !trimmedType || !trimmedEquipmentId) {
    return null;
  }

  return Equipment.findOne({
    where: {
      campus: { [Op.in]: getCampusVariants(campusName) },
      equipmentId: trimmedEquipmentId,
      ...(typeMatchClause || {})
    },
    transaction
  });
}
