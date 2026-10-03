/**
 * Equipment Enhancements API Routes
 * Consolidates all new equipment management features
 */

import express from 'express';
const router = express.Router();

// Import controllers
import * as equipmentSetController from '../controllers/equipmentSetController.js';
import * as inventoryCheckController from '../controllers/inventoryCheckController.js';
import * as usageTrackingController from '../controllers/usageTrackingController.js';
import * as auditTrailController from '../controllers/auditTrailController.js';
import * as technicianReportController from '../controllers/technicianReportController.js';

// Middleware (assuming you have authentication middleware)
// const { authenticate, authorize } = require('../middleware/auth');

// ============================================================================
// EQUIPMENT SETS ROUTES
// ============================================================================

// Get all equipment sets
router.get('/sets', equipmentSetController.getAllSets);

// Get single equipment set with its equipment
router.get('/sets/:id', equipmentSetController.getSetById);

// Create new equipment set (admin/technician only)
router.post('/sets', equipmentSetController.createSet);

// Update equipment set (admin/technician only)
router.put('/sets/:id', equipmentSetController.updateSet);

// Delete equipment set (admin only - must be empty)
router.delete('/sets/:id', equipmentSetController.deleteSet);

// Add equipment to set
router.post('/sets/:setId/equipment', equipmentSetController.addEquipmentToSet);

// Remove equipment from set
router.delete('/sets/:setId/equipment', equipmentSetController.removeEquipmentFromSet);

// ============================================================================
// INVENTORY CHECK ROUTES
// ============================================================================

// Get all inventory checks
router.get('/inventory-checks', inventoryCheckController.getAllChecks);

// Get single inventory check with items
router.get('/inventory-checks/:id', inventoryCheckController.getCheckById);

// Create new inventory check (technician/admin only)
router.post('/inventory-checks', inventoryCheckController.createCheck);

// Add item to inventory check
router.post('/inventory-checks/:checkId/items', inventoryCheckController.addCheckItem);

// Complete inventory check
router.post('/inventory-checks/:id/complete', inventoryCheckController.completeCheck);

// Review inventory check (admin only)
router.post('/inventory-checks/:id/review', inventoryCheckController.reviewCheck);

// Get inventory statistics
router.get('/inventory-checks/stats/summary', inventoryCheckController.getInventoryStats);

// ============================================================================
// USAGE TRACKING ROUTES
// ============================================================================

// Start equipment usage session
router.post('/usage/start', usageTrackingController.startUsageSession);

// End equipment usage session
router.post('/usage/:id/end', usageTrackingController.endUsageSession);

// Get equipment usage history
router.get('/usage/equipment/:equipmentId', usageTrackingController.getEquipmentUsageHistory);

// Get user usage history
router.get('/usage/user/:userId', usageTrackingController.getUserUsageHistory);

// Get usage statistics
router.get('/usage/stats', usageTrackingController.getUsageStatistics);

// Get currently active sessions
router.get('/usage/active', usageTrackingController.getActiveSessions);

// Link usage log to attendance
router.post('/usage/link-attendance', usageTrackingController.linkToAttendance);

// ============================================================================
// AUDIT TRAIL ROUTES
// ============================================================================

// Get all audit trail entries (with filtering)
router.get('/audit', auditTrailController.getAuditTrail);

// Get audit trail for specific equipment
router.get('/audit/equipment/:equipmentId', auditTrailController.getEquipmentAuditTrail);

// Get audit trail by user
router.get('/audit/user/:userId', auditTrailController.getUserAuditTrail);

// Get audit statistics
router.get('/audit/stats', auditTrailController.getAuditStatistics);

// Get recent activity
router.get('/audit/recent', auditTrailController.getRecentActivity);

// Search audit trail
router.get('/audit/search', auditTrailController.searchAuditTrail);

// Export audit trail to CSV (admin only)
router.get('/audit/export/csv', auditTrailController.exportAuditTrail);

// ============================================================================
// TECHNICIAN REPORT ROUTES
// ============================================================================

// Get all technician reports
router.get('/reports', technicianReportController.getAllReports);

// Get single report
router.get('/reports/:id', technicianReportController.getReportById);

// Create new report (technician/admin only)
router.post('/reports', technicianReportController.createReport);

// Update report (own reports or admin)
router.put('/reports/:id', technicianReportController.updateReport);

// Submit report for review
router.post('/reports/:id/submit', technicianReportController.submitReport);

// Review report (admin only)
router.post('/reports/:id/review', technicianReportController.reviewReport);

// Delete report (draft only or admin)
router.delete('/reports/:id', technicianReportController.deleteReport);

// Get report statistics
router.get('/reports/stats/summary', technicianReportController.getReportStatistics);

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Equipment Enhancements API is running',
        version: '1.0.0',
        features: [
            'Serial Number Tracking',
            'Equipment Sets',
            'Usage Tracking',
            'Audit Trail',
            'Inventory Checks',
            'Technician Reports'
        ]
    });
});

module.exports = router;
