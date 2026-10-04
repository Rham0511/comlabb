/**
 * Technician Report Controller
 * Manages weekly technician reports
 */

import EquipmentTechnicianReport from '../models/equipmentTechnicianReportModel.js';
import { Equipment } from '../models/equipmentModel.js';
import { Op } from 'sequelize';

function getSessionUser(req) {
    return {
        id: req.session?.userId || req.user?.id,
        name: req.session?.userName || req.user?.name || req.user?.email || 'Technician',
        role: String(req.session?.userRole || req.user?.role || '').toLowerCase()
    };
}

/**
 * Generate report ID based on date
 * Format: TECH-YYYY-WXX (e.g., TECH-2026-W40)
 */
function generateReportId(date = new Date()) {
    const year = date.getFullYear();
    
    // Calculate week number
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    return `TECH-${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Get all technician reports
 */
async function getAllReports(req, res) {
    try {
        const {
            campusId,
            laboratoryId,
            technicianId,
            reportType,
            status,
            startDate,
            endDate
        } = req.query;
        
        const whereClause = {};
        if (campusId) whereClause.campusId = campusId;
        if (laboratoryId) whereClause.laboratoryId = laboratoryId;
        if (technicianId) whereClause.technicianId = technicianId;
        if (reportType) whereClause.reportType = reportType;
        if (status) whereClause.status = status;
        
        if (startDate || endDate) {
            whereClause.reportDate = {};
            if (startDate) whereClause.reportDate[Op.gte] = startDate;
            if (endDate) whereClause.reportDate[Op.lte] = endDate;
        }
        
        const reports = await EquipmentTechnicianReport.findAll({
            where: whereClause,
            order: [['reportDate', 'DESC']]
        });
        
        res.json({
            success: true,
            reports
        });
        
    } catch (error) {
        console.error('Error fetching technician reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch technician reports',
            error: error.message
        });
    }
}

/**
 * Get single report by ID
 */
async function getReportById(req, res) {
    try {
        const { id } = req.params;
        
        const report = await EquipmentTechnicianReport.findOne({
            where: {
                [Op.or]: [
                    { id: id },
                    { reportId: id }
                ]
            }
        });
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        res.json({
            success: true,
            report
        });
        
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report',
            error: error.message
        });
    }
}

async function getReportEquipmentOptions(req, res) {
    try {
        const actor = getSessionUser(req);
        if (!actor.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

        const equipment = await Equipment.findAll({
            attributes: ['id', 'equipmentId', 'name', 'serialNumber', 'category', 'campus', 'laboratoryRoom', 'status'],
            order: [['name', 'ASC'], ['equipmentId', 'ASC']]
        });

        res.json({
            success: true,
            equipment: equipment.map((item) => item.toJSON())
        });
    } catch (error) {
        console.error('Error fetching technician report equipment options:', error);
        res.status(500).json({ success: false, message: 'Failed to load equipment options.' });
    }
}

/**
 * Create new technician report
 */
async function createReport(req, res) {
    try {
        const {
            reportDate,
            campusId: submittedCampusId,
            laboratoryId,
            reportType = 'weekly',
            summary,
            equipmentIssuesCount = 0,
            maintenancePerformed = 0,
            newEquipmentAdded = 0,
            equipmentRetired = 0,
            inventoryCheckCompleted = false,
            inventoryCheckId,
            recommendations,
            attachments,
            equipmentId,
            serialNumber,
            issueType
        } = req.body;
        const actor = getSessionUser(req);
        if (!actor.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
        
        // Validate required fields
        const date = reportDate ? new Date(reportDate) : new Date();
        const reportId = reportType === 'incident' || reportType === 'maintenance'
            ? `TECH-${String(reportType).toUpperCase()}-${Date.now()}`
            : generateReportId(date);

        let equipment = null;
        if (equipmentId || serialNumber) {
            equipment = await Equipment.findOne({
                where: equipmentId ? { id: equipmentId } : { serialNumber }
            });
            if (!equipment) return res.status(404).json({ success: false, message: 'Equipment was not found.' });
        }

        const campusId = equipment?.campus
            || equipment?.campusId
            || submittedCampusId
            || req.session?.userCampus
            || req.user?.campus
            || req.user?.campusId
            || null;
        if (!campusId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to determine the campus. Select equipment with a campus assignment or contact an administrator.'
            });
        }
        
        // Calculate week number
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        
        // Check if report already exists for this week and technician
        const existingReport = await EquipmentTechnicianReport.findOne({
            where: {
                reportId,
                technicianId: actor.id,
                reportType: 'weekly'
            }
        });
        
        if (existingReport && reportType === 'weekly') {
            return res.status(400).json({
                success: false,
                message: `Weekly report already exists for this week: ${reportId}`,
                existingReport
            });
        }
        
        // Create report
        const newReport = await EquipmentTechnicianReport.create({
            reportId,
            reportDate: date,
            weekNumber,
            campusId,
            laboratoryId,
            technicianId: actor.id,
            technicianName: actor.name,
            equipmentId: equipment?.id || equipmentId || null,
            serialNumber: equipment?.serialNumber || serialNumber || null,
            issueType: issueType || null,
            reportType,
            summary,
            equipmentIssuesCount,
            maintenancePerformed,
            newEquipmentAdded,
            equipmentRetired,
            inventoryCheckCompleted,
            inventoryCheckId,
            recommendations,
            attachments: attachments ? JSON.stringify(attachments) : null,
            status: 'draft'
        });
        
        res.status(201).json({
            success: true,
            message: 'Technician report created successfully',
            report: newReport
        });
        
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create report',
            error: error.message
        });
    }
}

/**
 * Update report (only draft or own reports)
 */
async function updateReport(req, res) {
    try {
        const actor = getSessionUser(req);
        const { id } = req.params;
        const updates = req.body;
        
        const report = await EquipmentTechnicianReport.findByPk(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        // Check permissions
        if (report.technicianId !== actor.id && actor.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own reports'
            });
        }
        
        // Can't edit submitted, reviewed, or approved reports unless admin
        if (['submitted', 'reviewed', 'approved'].includes(report.status) && actor.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit ${report.status} reports`
            });
        }
        
        // Handle attachments
        if (updates.attachments) {
            updates.attachments = JSON.stringify(updates.attachments);
        }
        
        await report.update(updates);
        
        res.json({
            success: true,
            message: 'Report updated successfully',
            report
        });
        
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update report',
            error: error.message
        });
    }
}

/**
 * Submit report for review
 */
async function submitReport(req, res) {
    try {
        const actor = getSessionUser(req);
        const { id } = req.params;
        
        const report = await EquipmentTechnicianReport.findByPk(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        // Check permissions
        if (report.technicianId !== actor.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only submit your own reports'
            });
        }
        
        if (report.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft reports can be submitted'
            });
        }
        
        // Validate required fields
        if (!report.summary || report.summary.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Report summary is required (minimum 10 characters)'
            });
        }
        
        await report.update({
            status: 'submitted',
            submittedAt: new Date()
        });
        
        res.json({
            success: true,
            message: 'Report submitted successfully',
            report
        });
        
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report',
            error: error.message
        });
    }
}

/**
 * Review report (admin only)
 */
async function reviewReport(req, res) {
    try {
        const actor = getSessionUser(req);
        const { id } = req.params;
        const { reviewComments, approved = true } = req.body;
        
        const report = await EquipmentTechnicianReport.findByPk(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        if (report.status !== 'submitted') {
            return res.status(400).json({
                success: false,
                message: 'Only submitted reports can be reviewed'
            });
        }
        
        await report.update({
            status: approved ? 'approved' : 'reviewed',
            reviewedBy: actor.id,
            reviewedAt: new Date(),
            reviewComments
        });
        
        res.json({
            success: true,
            message: approved ? 'Report approved successfully' : 'Report reviewed successfully',
            report
        });
        
    } catch (error) {
        console.error('Error reviewing report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review report',
            error: error.message
        });
    }
}

/**
 * Delete report (draft only or admin)
 */
async function deleteReport(req, res) {
    try {
        const actor = getSessionUser(req);
        const { id } = req.params;
        
        const report = await EquipmentTechnicianReport.findByPk(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        // Check permissions
        if (report.technicianId !== actor.id && actor.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own reports'
            });
        }
        
        // Can only delete draft reports unless admin
        if (report.status !== 'draft' && actor.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Only draft reports can be deleted'
            });
        }
        
        await report.destroy();
        
        res.json({
            success: true,
            message: 'Report deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete report',
            error: error.message
        });
    }
}

/**
 * Get report statistics
 */
async function getReportStatistics(req, res) {
    try {
        const { campusId, startDate, endDate } = req.query;
        
        const whereClause = {};
        if (campusId) whereClause.campusId = campusId;
        
        if (startDate || endDate) {
            whereClause.reportDate = {};
            if (startDate) whereClause.reportDate[Op.gte] = startDate;
            if (endDate) whereClause.reportDate[Op.lte] = endDate;
        }
        
        const reports = await EquipmentTechnicianReport.findAll({
            where: whereClause,
            attributes: [
                'equipmentIssuesCount',
                'maintenancePerformed',
                'newEquipmentAdded',
                'equipmentRetired',
                'inventoryCheckCompleted'
            ]
        });
        
        const stats = {
            totalReports: reports.length,
            totalIssues: reports.reduce((sum, r) => sum + (r.equipmentIssuesCount || 0), 0),
            totalMaintenance: reports.reduce((sum, r) => sum + (r.maintenancePerformed || 0), 0),
            totalAdded: reports.reduce((sum, r) => sum + (r.newEquipmentAdded || 0), 0),
            totalRetired: reports.reduce((sum, r) => sum + (r.equipmentRetired || 0), 0),
            inventoryChecksCompleted: reports.filter(r => r.inventoryCheckCompleted).length
        };
        
        res.json({
            success: true,
            statistics: stats
        });
        
    } catch (error) {
        console.error('Error fetching report statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report statistics',
            error: error.message
        });
    }
}

export {
    getReportEquipmentOptions,
    getAllReports,
    getReportById,
    createReport,
    updateReport,
    submitReport,
    reviewReport,
    deleteReport,
    getReportStatistics
};
