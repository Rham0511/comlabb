import { AuditLog } from "../models/auditLogModel.js";
import { User } from "../models/userModel.js";

const safeStringify = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  try {
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  } catch {
    return String(value);
  }
};

export const normalizeRoleName = (role) => String(role || "").trim().toLowerCase();

export const getRequestRoleValue = (req) => {
  const candidates = [
    req?.session?.userRole,
    req?.session?.user?.role,
    req?.session?.role,
    req?.user?.role,
    req?.headers?.["x-user-role"],
    req?.headers?.["X-User-Role"]
  ];

  return candidates.find((candidate) => candidate != null && String(candidate).trim() !== "") || "";
};

export const resolveUserRoleFromSession = async (req) => {
  const sessionRole = getRequestRoleValue(req);
  if (sessionRole) {
    return normalizeRoleName(sessionRole);
  }

  const userId = req?.session?.userId ?? req?.user?.id ?? null;
  if (!userId) {
    return "";
  }

  try {
    const user = await User.findByPk(userId, { attributes: ["role"] });
    return normalizeRoleName(user?.role || "");
  } catch (error) {
    console.warn("Failed to resolve user role from session for audit access.", error?.message || error);
    return "";
  }
};

export const isAdminRole = (role) => {
  const normalizedRole = normalizeRoleName(role);
  return normalizedRole === "admin" || normalizedRole === "administrator";
};

const isCentralAdminRole = (role) => {
  const normalizedRole = normalizeRoleName(role).replace(/[_-]+/g, "");
  return ["superadmin", "centraladmin", "systemadmin"].includes(normalizedRole);
};

export const canBypassAuditAccessForDev = (req) => {
  if (process.env.NODE_ENV !== "development") return false;
  const devRole = normalizeRoleName(req?.headers?.["x-dev-role"] || req?.query?.devRole || req?.query?.role);
  const rawDevBypass = String(req?.query?.devBypass || "").toLowerCase();
  const devBypass = rawDevBypass === "1" || rawDevBypass === "true";
  return devRole === "admin" || devBypass;
};

export const logAuditEntry = async (req, { action, module, resourceId = null, description = null, actorName = null, actorRole = null }) => {
  try {
    const userId = req?.session?.userId || null;
    const sessionRole = req?.session?.userRole || null;
    const roleValue = actorRole || sessionRole || null;
    let nameValue = actorName || null;
    let campusValue = null;

    if (userId) {
      const user = await User.findByPk(userId, { attributes: ["name", "campus"] });
      if (!nameValue && user?.name) nameValue = user.name;
      campusValue = user?.campus || null;
    }

    await AuditLog.create({
      userId,
      actorName: nameValue,
      actorRole: roleValue,
      action: String(action || "Unknown Action").trim(),
      module: String(module || "System").trim(),
      resourceId: resourceId != null ? String(resourceId) : null,
      description: description != null ? String(description) : null,
      userCampus: campusValue
    });
  } catch (error) {
    console.warn("Failed to write audit log entry:", error?.message || error);
  }
};

export const requireAdminForAudit = async (req, res, next) => {
  if (canBypassAuditAccessForDev(req)) {
    return next();
  }

  if (!req.session?.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const resolvedRole = await resolveUserRoleFromSession(req);
  if (isAdminRole(resolvedRole) || isCentralAdminRole(resolvedRole)) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden" });
};

export const normalizeCampusValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*campus\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
};

export const getAuditLogs = async (req, res) => {
  if (canBypassAuditAccessForDev(req)) {
    // Development-only bypass for local Audit Logs verification.
  } else if (!req.session?.userId) {
    return res.status(403).json({ error: "Forbidden" });
  } else {
    const resolvedRole = await resolveUserRoleFromSession(req);
    if (!isAdminRole(resolvedRole) && !isCentralAdminRole(resolvedRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  try {
    const { q, userId, dateFrom, dateTo, campus, page = 1, pageSize = 25, exportAll = false } = req.query;
    const where = {};
    const { Op } = await import("sequelize");
    const shouldExportAll = String(exportAll || "").toLowerCase() === "1" || String(exportAll || "").toLowerCase() === "true";

    const authenticatedUser = await User.findByPk(req.session?.userId, { attributes: ["id", "role", "campus"] });
    if (!authenticatedUser) return res.status(403).json({ error: "Forbidden" });
    const authenticatedRole = normalizeRoleName(authenticatedUser.role || req.session?.userRole || "");
    const isGlobalAdmin = isCentralAdminRole(authenticatedRole);
    const userCampus = authenticatedUser.campus || null;
    const selectedCampus = campus ? String(campus).trim() : "";
    const selectedCampusKey = normalizeCampusValue(selectedCampus);
    const userCampusKey = normalizeCampusValue(userCampus || "");

    if (!isGlobalAdmin && !userCampusKey) {
      return res.status(403).json({ error: "Unauthorized: User campus not found." });
    }

    let effectiveCampusKey = selectedCampusKey || userCampusKey;
    if (!isGlobalAdmin && selectedCampusKey && selectedCampusKey !== userCampusKey) {
      return res.status(403).json({ error: "You do not have permission to view audit logs for another campus." });
    }

    if (effectiveCampusKey) {
      const campusUsers = await User.findAll({
        where: {
          campus: {
            [Op.or]: [
              { [Op.like]: effectiveCampusKey },
              { [Op.like]: `${effectiveCampusKey} Campus` }
            ]
          }
        },
        attributes: ["id"]
      });
      const campusUserIds = campusUsers.map((user) => user.id);
      const campusRecordConditions = [
        ...(campusUserIds.length ? [{ userId: { [Op.in]: campusUserIds } }] : []),
        {
          userId: null,
          userCampus: {
            [Op.or]: [
              { [Op.like]: effectiveCampusKey },
              { [Op.like]: `${effectiveCampusKey} Campus` }
            ]
          }
        }
      ];
      where[Op.and] = [{ [Op.or]: campusRecordConditions }];
    }

    const filterConditions = [];

    if (userId) {
      const resolvedUserId = Number(userId);
      const userFilterConditions = [];
      if (!Number.isNaN(resolvedUserId)) {
        userFilterConditions.push({ userId: resolvedUserId });
      }

      if (!Number.isNaN(resolvedUserId)) {
        const selectedUser = await User.findByPk(resolvedUserId, { attributes: ["name"] });
        if (selectedUser?.name) {
          userFilterConditions.push({ actorName: { [Op.like]: `%${selectedUser.name}%` } });
        }
      }

      if (userFilterConditions.length === 1) {
        filterConditions.push(userFilterConditions[0]);
      } else if (userFilterConditions.length > 1) {
        filterConditions.push({ [Op.or]: userFilterConditions });
      }
    }

    if (dateFrom || dateTo) {
      const createdAtRange = {};
      if (dateFrom) {
        createdAtRange[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        createdAtRange[Op.lte] = toDate;
      }
      filterConditions.push({ createdAt: createdAtRange });
    }

    if (q) {
      const term = String(q).trim();
      if (term) {
        filterConditions.push({
          [Op.or]: [
            { actorName: { [Op.like]: `%${term}%` } },
            { actorRole: { [Op.like]: `%${term}%` } },
            { action: { [Op.like]: `%${term}%` } },
            { module: { [Op.like]: `%${term}%` } },
            { description: { [Op.like]: `%${term}%` } }
          ]
        });
      }
    }

    if (filterConditions.length) {
      where[Op.and] = [...(where[Op.and] || []), ...filterConditions];
    }

    const resolvedPage = Math.max(1, Number(page) || 1);
    const requestedPageSize = Math.max(1, Number(pageSize) || 25);
    const resolvedPageSize = shouldExportAll ? Math.min(5000, requestedPageSize) : Math.min(100, requestedPageSize);
    const offset = (resolvedPage - 1) * resolvedPageSize;

    if (shouldExportAll) {
      const rows = await AuditLog.findAll({
        where,
        order: [["createdAt", "DESC"]]
      });

      return res.json({
        data: rows,
        meta: {
          total: rows.length,
          page: 1,
          pageSize: rows.length,
          totalPages: 1
        }
      });
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit: resolvedPageSize
    });

    res.json({
      data: rows,
      meta: {
        total: count,
        page: resolvedPage,
        pageSize: resolvedPageSize,
        totalPages: Math.ceil(count / resolvedPageSize)
      }
    });
  } catch (error) {
    console.error("Failed to load audit logs:", error);
    res.status(500).json({ error: "Failed to load audit logs." });
  }
};