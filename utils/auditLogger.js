/**
 * Audit Trail Logger Utility
 * Logs all equipment-related actions for accountability and compliance
 */

import EquipmentAuditTrail from '../models/equipmentAuditTrailModel.js';

/**
 * Log an equipment action to the audit trail
 * @param {Object} params - Audit log parameters
 * @param {number} params.equipmentId - Equipment ID
 * @param {string} params.serialNumber - Equipment serial number
 * @param {string} params.actionType - Type of action performed
 * @param {string} params.actionDescription - Human-readable description
 * @param {number} params.performedBy - User ID who performed action
 * @param {string} params.performedByName - Username
 * @param {string} params.userRole - User role at time of action
 * @param {number} params.campusId - Campus ID
 * @param {Object} params.beforeState - State before action (optional)
 * @param {Object} params.afterState - State after action (optional)
 * @param {Object} params.req - Express request object (for IP/user agent)
 * @returns {Promise<Object>} Created audit log entry
 */
async function logEquipmentAction(params) {
    try {
        const {
            equipmentId,
            serialNumber,
            actionType,
            actionDescription,
            performedBy,
            performedByName,
            userRole,
            campusId,
            beforeState = null,
            afterState = null,
            req = null
        } = params;

        // Extract IP address and user agent from request if available
        let ipAddress = null;
        let userAgent = null;

        if (req) {
            // Get real IP (handles proxies and load balancers)
            ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                     || req.headers['x-real-ip'] 
                     || req.connection?.remoteAddress 
                     || req.socket?.remoteAddress
                     || null;

            userAgent = req.headers['user-agent'] || null;
        }

        // Create audit log entry
        const auditEntry = await EquipmentAuditTrail.create({
            equipmentId,
            serialNumber,
            actionType,
            actionDescription,
            performedBy,
            performedByName,
            userRole,
            campusId,
            beforeState: beforeState ? JSON.stringify(beforeState) : null,
            afterState: afterState ? JSON.stringify(afterState) : null,
            ipAddress,
            userAgent,
            actionTimestamp: new Date()
        });

        return auditEntry;
    } catch (error) {
        console.error('Error logging equipment action:', error);
        // Don't throw - audit logging should not break main functionality
        return null;
    }
}

/**
 * Log equipment creation
 */
async function logEquipmentCreated(equipment, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'created',
        actionDescription: `Equipment created: ${equipment.name} (${equipment.serialNumber || equipment.equipmentId})`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: equipment.toJSON ? equipment.toJSON() : equipment,
        req
    });
}

/**
 * Log equipment update
 */
async function logEquipmentUpdated(equipmentBefore, equipmentAfter, user, req) {
    // Identify what changed
    const changes = [];
    const beforeData = equipmentBefore.toJSON ? equipmentBefore.toJSON() : equipmentBefore;
    const afterData = equipmentAfter.toJSON ? equipmentAfter.toJSON() : equipmentAfter;
    
    for (const key in afterData) {
        if (beforeData[key] !== afterData[key] && key !== 'updatedAt') {
            changes.push(`${key}: ${beforeData[key]} → ${afterData[key]}`);
        }
    }

    const description = changes.length > 0 
        ? `Equipment updated: ${changes.join(', ')}`
        : 'Equipment updated';

    return await logEquipmentAction({
        equipmentId: equipmentAfter.id,
        serialNumber: equipmentAfter.serialNumber,
        actionType: 'updated',
        actionDescription: description,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipmentAfter.campus,
        beforeState: beforeData,
        afterState: afterData,
        req
    });
}

/**
 * Log equipment deletion
 */
async function logEquipmentDeleted(equipment, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'deleted',
        actionDescription: `Equipment deleted: ${equipment.name} (${equipment.serialNumber || equipment.equipmentId})`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        beforeState: equipment.toJSON ? equipment.toJSON() : equipment,
        req
    });
}

/**
 * Log equipment borrowed
 */
async function logEquipmentBorrowed(equipment, borrower, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'borrowed',
        actionDescription: `Equipment borrowed by ${borrower.name || borrower.email} (ID: ${borrower.studentId || borrower.id})`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: { borrowedBy: borrower.id, borrowedAt: new Date() },
        req
    });
}

/**
 * Log equipment returned
 */
async function logEquipmentReturned(equipment, returnedBy, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'returned',
        actionDescription: `Equipment returned by ${returnedBy.name || returnedBy.email}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: { returnedBy: returnedBy.id, returnedAt: new Date() },
        req
    });
}

/**
 * Log maintenance started
 */
async function logMaintenanceStarted(equipment, maintenanceRequest, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'maintenance_started',
        actionDescription: `Maintenance started: ${maintenanceRequest.issueDescription || 'Scheduled maintenance'}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: { maintenanceId: maintenanceRequest.id, status: 'under_maintenance' },
        req
    });
}

/**
 * Log maintenance completed
 */
async function logMaintenanceCompleted(equipment, maintenanceRequest, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'maintenance_completed',
        actionDescription: `Maintenance completed: ${maintenanceRequest.resolutionNotes || 'Maintenance finished'}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: { maintenanceId: maintenanceRequest.id, status: 'serviceable' },
        req
    });
}

/**
 * Log status change
 */
async function logStatusChanged(equipment, oldStatus, newStatus, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'status_changed',
        actionDescription: `Status changed from ${oldStatus} to ${newStatus}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        beforeState: { status: oldStatus },
        afterState: { status: newStatus },
        req
    });
}

/**
 * Log condition change
 */
async function logConditionChanged(equipment, oldCondition, newCondition, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'condition_changed',
        actionDescription: `Condition changed from ${oldCondition} to ${newCondition}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        beforeState: { condition: oldCondition },
        afterState: { condition: newCondition },
        req
    });
}

/**
 * Log location change
 */
async function logLocationChanged(equipment, oldLocation, newLocation, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'location_changed',
        actionDescription: `Location changed from ${oldLocation} to ${newLocation}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        beforeState: { location: oldLocation },
        afterState: { location: newLocation },
        req
    });
}

/**
 * Log equipment assigned to set
 */
async function logAssignedToSet(equipment, setId, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'assigned_to_set',
        actionDescription: `Equipment assigned to set: ${setId}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        afterState: { setId },
        req
    });
}

/**
 * Log equipment removed from set
 */
async function logRemovedFromSet(equipment, setId, user, req) {
    return await logEquipmentAction({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        actionType: 'removed_from_set',
        actionDescription: `Equipment removed from set: ${setId}`,
        performedBy: user.id,
        performedByName: user.name || user.email,
        userRole: user.role,
        campusId: equipment.campus,
        beforeState: { setId },
        afterState: { setId: null },
        req
    });
}

export {
    logEquipmentAction,
    logEquipmentCreated,
    logEquipmentUpdated,
    logEquipmentDeleted,
    logEquipmentBorrowed,
    logEquipmentReturned,
    logMaintenanceStarted,
    logMaintenanceCompleted,
    logStatusChanged,
    logConditionChanged,
    logLocationChanged,
    logAssignedToSet,
    logRemovedFromSet
};
