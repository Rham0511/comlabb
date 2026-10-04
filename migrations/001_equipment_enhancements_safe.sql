-- ============================================================================
-- EQUIPMENT MANAGEMENT ENHANCEMENTS - SAFE MIGRATION
-- Compatible with MySQL 8.x
-- ============================================================================

-- 1. CREATE NEW TABLES (with IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS equipment_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setId VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique set identifier (e.g., PC-SET-001)',
    setName VARCHAR(255) NOT NULL COMMENT 'Display name for the set',
    description TEXT COMMENT 'Description of what this set contains',
    campusId INT COMMENT 'Which campus this set belongs to',
    laboratoryId INT COMMENT 'Which laboratory this set belongs to',
    location VARCHAR(255) COMMENT 'Physical location of the set',
    status ENUM('active', 'maintenance', 'incomplete', 'retired') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    createdBy INT COMMENT 'User ID who created this set',
    INDEX idx_setId (setId),
    INDEX idx_campusId (campusId),
    INDEX idx_laboratoryId (laboratoryId),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_usage_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attendanceId INT COMMENT 'Links to attendance record',
    equipmentId INT COMMENT 'Equipment being used',
    serialNumber VARCHAR(100) COMMENT 'Serial number for quick reference',
    userId INT NOT NULL COMMENT 'Student/user using the equipment',
    campusId INT NOT NULL,
    laboratoryId INT,
    usageStartTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usageEndTime TIMESTAMP NULL,
    durationMinutes INT COMMENT 'Auto-calculated usage duration',
    sessionNotes TEXT COMMENT 'Notes about this usage session',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_attendanceId (attendanceId),
    INDEX idx_equipmentId (equipmentId),
    INDEX idx_serialNumber (serialNumber),
    INDEX idx_userId (userId),
    INDEX idx_campusId (campusId),
    INDEX idx_usageDate (usageStartTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_audit_trail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipmentId INT COMMENT 'Equipment affected by this action',
    serialNumber VARCHAR(100) COMMENT 'Serial number for quick reference',
    actionType ENUM('created', 'updated', 'deleted', 'borrowed', 'returned', 'maintenance_started', 'maintenance_completed', 'status_changed', 'condition_changed', 'location_changed', 'assigned_to_set', 'removed_from_set') NOT NULL,
    actionDescription TEXT COMMENT 'Human-readable description of the action',
    performedBy INT NOT NULL COMMENT 'User who performed the action',
    performedByName VARCHAR(255) COMMENT 'Cached username for reports',
    userRole ENUM('student', 'faculty', 'technician', 'admin') COMMENT 'Role at time of action',
    campusId INT,
    beforeState JSON COMMENT 'Equipment state before action (JSON)',
    afterState JSON COMMENT 'Equipment state after action (JSON)',
    ipAddress VARCHAR(45) COMMENT 'IP address of user',
    userAgent TEXT COMMENT 'Browser/client info',
    actionTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_equipmentId (equipmentId),
    INDEX idx_serialNumber (serialNumber),
    INDEX idx_actionType (actionType),
    INDEX idx_performedBy (performedBy),
    INDEX idx_campusId (campusId),
    INDEX idx_actionTimestamp (actionTimestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_inventory_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checkId VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique check identifier (e.g., INV-2026-W40)',
    checkDate DATE NOT NULL COMMENT 'Date of inventory check',
    campusId INT NOT NULL,
    laboratoryId INT COMMENT 'Specific lab or NULL for entire campus',
    performedBy INT NOT NULL COMMENT 'Technician/admin who performed check',
    performedByName VARCHAR(255) COMMENT 'Cached username',
    status ENUM('in_progress', 'completed', 'reviewed') DEFAULT 'in_progress',
    totalItemsExpected INT COMMENT 'Number of items that should be present',
    totalItemsFound INT COMMENT 'Number of items actually found',
    missingCount INT DEFAULT 0,
    damagedCount INT DEFAULT 0,
    notes TEXT COMMENT 'General notes about this inventory check',
    completedAt TIMESTAMP NULL,
    reviewedBy INT COMMENT 'Admin who reviewed this check',
    reviewedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_checkId (checkId),
    INDEX idx_checkDate (checkDate),
    INDEX idx_campusId (campusId),
    INDEX idx_laboratoryId (laboratoryId),
    INDEX idx_performedBy (performedBy),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_inventory_check_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventoryCheckId INT NOT NULL COMMENT 'Links to parent inventory check',
    equipmentId INT COMMENT 'Equipment being checked',
    serialNumber VARCHAR(100) COMMENT 'Serial number being checked',
    expectedLocation VARCHAR(255) COMMENT 'Where equipment should be',
    actualLocation VARCHAR(255) COMMENT 'Where equipment was found',
    status ENUM('found', 'missing', 'damaged', 'misplaced') NOT NULL,
    conditionBefore ENUM('excellent', 'good', 'fair', 'poor', 'broken'),
    conditionAfter ENUM('excellent', 'good', 'fair', 'poor', 'broken'),
    notes TEXT COMMENT 'Notes about this specific item',
    checkedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventoryCheckId (inventoryCheckId),
    INDEX idx_equipmentId (equipmentId),
    INDEX idx_serialNumber (serialNumber),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_technician_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reportId VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique report identifier (e.g., TECH-2026-W40)',
    reportDate DATE NOT NULL COMMENT 'Date report covers',
    weekNumber INT COMMENT 'Week number of year',
    campusId INT NOT NULL,
    laboratoryId INT COMMENT 'Specific lab or NULL for entire campus',
    technicianId INT NOT NULL COMMENT 'Technician who created report',
    technicianName VARCHAR(255) COMMENT 'Cached technician name',
    reportType ENUM('weekly', 'incident', 'maintenance', 'audit') DEFAULT 'weekly',
    summary TEXT COMMENT 'Executive summary of the report',
    equipmentIssuesCount INT DEFAULT 0,
    maintenancePerformed INT DEFAULT 0,
    newEquipmentAdded INT DEFAULT 0,
    equipmentRetired INT DEFAULT 0,
    inventoryCheckCompleted BOOLEAN DEFAULT FALSE,
    inventoryCheckId INT COMMENT 'Links to inventory check if performed',
    recommendations TEXT COMMENT 'Technician recommendations',
    attachments JSON COMMENT 'File paths or URLs to attachments',
    status ENUM('draft', 'submitted', 'reviewed', 'approved') DEFAULT 'draft',
    submittedAt TIMESTAMP NULL,
    reviewedBy INT COMMENT 'Admin who reviewed',
    reviewedAt TIMESTAMP NULL,
    reviewComments TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_reportId (reportId),
    INDEX idx_reportDate (reportDate),
    INDEX idx_weekNumber (weekNumber),
    INDEX idx_campusId (campusId),
    INDEX idx_technicianId (technicianId),
    INDEX idx_reportType (reportType),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MIGRATION COMPLETE - NEW TABLES CREATED
-- ============================================================================

SELECT 'Migration completed: 6 new tables created' AS status;
