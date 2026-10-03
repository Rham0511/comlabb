# Equipment Management Enhancement - Implementation Plan

**Date:** September 20, 2026  
**System:** ComLab - Computer Laboratory Facilities Management System  
**Project:** Equipment Tracking & Accountability Enhancement

---

## Executive Summary

This implementation plan adds comprehensive equipment tracking, inventory management, and accountability features to the existing ComLab system. The enhancements focus on Serial Number tracking, Equipment Set management, Usage History, and Audit Trail capabilities.

**Key Principles:**
- ✅ **NO breaking changes** to existing system
- ✅ **Backwards compatible** with current data
- ✅ **Additive approach** - only add new features
- ✅ **Preserve existing** authentication, roles, and workflows

---

## Table of Contents

1. [Database Schema Changes](#database-schema-changes)
2. [New Models](#new-models)
3. [Model Updates](#model-updates)
4. [Controller Enhancements](#controller-enhancements)
5. [Frontend Updates](#frontend-updates)
6. [Implementation Phases](#implementation-phases)
7. [Testing Plan](#testing-plan)
8. [Migration Strategy](#migration-strategy)

---

## 1. Database Schema Changes

### 1.1 New Tables to Create

#### **equipment_sets** (NEW)
Manages computer sets and equipment groupings

```sql
CREATE TABLE `equipment_sets` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `setId` VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g., SET-001, SET-002',
  `name` VARCHAR(255) NOT NULL COMMENT 'e.g., Computer Station 1',
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `stationNumber` INT NULL COMMENT 'Physical station number in lab',
  `description` TEXT NULL,
  `status` ENUM('Complete', 'Incomplete', 'Maintenance', 'Decommissioned') DEFAULT 'Complete',
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  INDEX `idx_campus_lab` (`campus`, `laboratoryRoom`),
  INDEX `idx_setId` (`setId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### **equipment_usage_logs** (NEW)
Tracks student equipment usage

```sql
CREATE TABLE `equipment_usage_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(255) NOT NULL,
  `studentName` VARCHAR(255) NOT NULL,
  `equipmentId` INT NOT NULL COMMENT 'FK to equipment.id',
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL COMMENT 'FK to equipment_sets.setId',
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `instructor` VARCHAR(255) NULL,
  `laboratoryScheduleId` INT NULL,
  `attendanceId` INT NULL COMMENT 'FK to attendance.id',
  `usageStartTime` DATETIME NOT NULL,
  `usageEndTime` DATETIME NULL,
  `duration` INT NULL COMMENT 'Minutes',
  `remarks` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  INDEX `idx_student` (`studentId`),
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_serial` (`serialNumber`),
  INDEX `idx_date` (`usageStartTime`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`attendanceId`) REFERENCES `attendance`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### **equipment_audit_trail** (NEW)
Complete audit log for equipment activities

```sql
CREATE TABLE `equipment_audit_trail` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `equipmentId` INT NOT NULL COMMENT 'FK to equipment.id',
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `actionType` ENUM(
    'Created', 'Updated', 'StatusChanged', 'SetAssigned', 'SetRemoved',
    'Borrowed', 'Returned', 'ReportedMissing', 'ReportedDamaged',
    'MaintenanceStarted', 'MaintenanceCompleted', 'MarkedForDisposal',
    'Disposed', 'QRGenerated', 'InventoryChecked', 'Other'
  ) NOT NULL,
  `actionDescription` TEXT NOT NULL,
  `previousValue` TEXT NULL COMMENT 'JSON of previous state',
  `newValue` TEXT NULL COMMENT 'JSON of new state',
  `performedBy` INT NOT NULL COMMENT 'FK to users.id',
  `performedByName` VARCHAR(255) NOT NULL,
  `performedByRole` VARCHAR(50) NOT NULL,
  `ipAddress` VARCHAR(50) NULL,
  `userAgent` TEXT NULL,
  `relatedRecordType` VARCHAR(100) NULL COMMENT 'e.g., BorrowRecord, MaintenanceRequest',
  `relatedRecordId` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_serial` (`serialNumber`),
  INDEX `idx_action` (`actionType`),
  INDEX `idx_date` (`createdAt`),
  INDEX `idx_user` (`performedBy`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### **equipment_inventory_checks** (NEW)
Weekly inventory verification records

```sql
CREATE TABLE `equipment_inventory_checks` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checkDate` DATE NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `checkedBy` INT NOT NULL COMMENT 'FK to users.id (technician)',
  `checkedByName` VARCHAR(255) NOT NULL,
  `totalEquipment` INT NOT NULL DEFAULT 0,
  `presentEquipment` INT NOT NULL DEFAULT 0,
  `missingEquipment` INT NOT NULL DEFAULT 0,
  `damagedEquipment` INT NOT NULL DEFAULT 0,
  `status` ENUM('In Progress', 'Completed', 'Reviewed') DEFAULT 'In Progress',
  `remarks` TEXT NULL,
  `completedAt` DATETIME NULL,
  `reviewedBy` INT NULL,
  `reviewedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  INDEX `idx_date` (`checkDate`),
  INDEX `idx_campus_lab` (`campus`, `laboratoryRoom`),
  INDEX `idx_technician` (`checkedBy`),
  FOREIGN KEY (`checkedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### **equipment_inventory_check_items** (NEW)
Individual equipment check details

```sql
CREATE TABLE `equipment_inventory_check_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `inventoryCheckId` INT NOT NULL,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `equipmentName` VARCHAR(255) NOT NULL,
  `previousStatus` VARCHAR(50) NOT NULL,
  `checkStatus` ENUM('Present', 'Missing', 'Damaged', 'Needs Repair') NOT NULL,
  `condition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional') NULL,
  `remarks` TEXT NULL,
  `photoUrl` VARCHAR(500) NULL,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_check` (`inventoryCheckId`),
  INDEX `idx_equipment` (`equipmentId`),
  FOREIGN KEY (`inventoryCheckId`) REFERENCES `equipment_inventory_checks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### **equipment_technician_reports** (NEW)
Technician incident/issue reports

```sql
CREATE TABLE `equipment_technician_reports` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `reportNumber` VARCHAR(50) NOT NULL UNIQUE,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `reportType` ENUM('Borrowed', 'Returned', 'Damaged', 'Missing', 'Malfunction', 'Repair Needed', 'Other') NOT NULL,
  `priority` ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
  `description` TEXT NOT NULL,
  `reportedBy` INT NOT NULL COMMENT 'FK to users.id (technician)',
  `reportedByName` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `incidentDate` DATETIME NOT NULL,
  `relatedStudentId` VARCHAR(255) NULL COMMENT 'If student-related',
  `relatedStudentName` VARCHAR(255) NULL,
  `actionTaken` TEXT NULL,
  `resolution` TEXT NULL,
  `status` ENUM('Pending', 'Acknowledged', 'In Progress', 'Resolved', 'Closed') DEFAULT 'Pending',
  `acknowledgedBy` INT NULL,
  `acknowledgedAt` DATETIME NULL,
  `resolvedAt` DATETIME NULL,
  `photoUrls` TEXT NULL COMMENT 'JSON array of photo URLs',
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  INDEX `idx_report_number` (`reportNumber`),
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_type` (`reportType`),
  INDEX `idx_status` (`status`),
  INDEX `idx_date` (`incidentDate`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reportedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 1.2 Existing Table Updates

#### **equipment** table modifications

```sql
-- Add new columns to existing equipment table
ALTER TABLE `equipment` 
ADD COLUMN `serialNumber` VARCHAR(100) NULL UNIQUE COMMENT 'Unique serial number for individual equipment' AFTER `equipmentId`,
ADD COLUMN `setId` VARCHAR(50) NULL COMMENT 'FK to equipment_sets.setId' AFTER `serialNumber`,
ADD COLUMN `manufacturer` VARCHAR(255) NULL AFTER `category`,
ADD COLUMN `model` VARCHAR(255) NULL AFTER `manufacturer`,
ADD COLUMN `purchaseDate` DATE NULL AFTER `dateAdded`,
ADD COLUMN `warrantyExpiry` DATE NULL AFTER `purchaseDate`,
ADD COLUMN `lastMaintenanceDate` DATE NULL,
ADD COLUMN `nextMaintenanceDate` DATE NULL,
ADD COLUMN `condition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional') DEFAULT 'Good',
ADD COLUMN `location` VARCHAR(500) NULL COMMENT 'Specific location within lab (e.g., Station 5, Left wall)',
ADD COLUMN `remarks` TEXT NULL,
ADD INDEX `idx_serialNumber` (`serialNumber`),
ADD INDEX `idx_setId` (`setId`);

-- Update status enum to include more states
ALTER TABLE `equipment` 
MODIFY COLUMN `status` ENUM(
  'Operational', 'In Use', 'Available', 
  'Missing', 'For Repair', 'Under Maintenance', 
  'For Disposal', 'Disposed', 'Serviceable', 'Unserviceable', 'Lost'
) DEFAULT 'Operational';
```

#### **attendance** table modifications

```sql
-- Add equipment tracking to attendance
ALTER TABLE `attendance`
ADD COLUMN `equipmentId` INT NULL COMMENT 'Equipment/PC used by student' AFTER `laboratoryScheduleId`,
ADD COLUMN `serialNumber` VARCHAR(100) NULL AFTER `equipmentId`,
ADD COLUMN `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN `stationNumber` INT NULL COMMENT 'Physical station number' AFTER `setId`,
ADD INDEX `idx_equipment` (`equipmentId`),
ADD INDEX `idx_serial` (`serialNumber`);
```

#### **borrow_records** table modifications

```sql
-- Enhance borrow records with serial number tracking
ALTER TABLE `borrow_records`
ADD COLUMN `serialNumber` VARCHAR(100) NULL AFTER `equipmentId`,
ADD COLUMN `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN `returnCondition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Damaged') NULL AFTER `condition`,
ADD COLUMN `damageDescription` TEXT NULL AFTER `returnCondition`,
ADD COLUMN `returnPhotoUrl` VARCHAR(500) NULL,
ADD INDEX `idx_serial` (`serialNumber`);
```

#### **maintenance_requests** table modifications

```sql
-- Add serial number and set tracking to maintenance
ALTER TABLE `maintenance_requests`
ADD COLUMN `serialNumber` VARCHAR(100) NULL AFTER `equipment_id`,
ADD COLUMN `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN `partsReplaced` TEXT NULL COMMENT 'JSON array of replaced parts',
ADD COLUMN `maintenanceCost` DECIMAL(10,2) NULL DEFAULT 0,
ADD COLUMN `completionNotes` TEXT NULL,
ADD INDEX `idx_serial` (`serialNumber`);
```

---

## 2. New Models

### 2.1 EquipmentSet Model

Create: `/home/ubuntu/ComLab/models/equipmentSetModel.js`

```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const EquipmentSet = sequelize.define("EquipmentSet", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'e.g., SET-001, SET-B205-01'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., Computer Station 1'
  },
  laboratoryRoom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  campus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stationNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Physical station number in lab'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Complete', 'Incomplete', 'Maintenance', 'Decommissioned'),
    defaultValue: 'Complete'
  }
}, {
  timestamps: true,
  tableName: "equipment_sets",
  indexes: [
    { fields: ['campus', 'laboratoryRoom'] },
    { fields: ['setId'] }
  ]
});

export { sequelize };
```

### 2.2 EquipmentUsageLog Model

Create: `/home/ubuntu/ComLab/models/equipmentUsageLogModel.js`

```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const EquipmentUsageLog = sequelize.define("EquipmentUsageLog", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  studentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'equipment',
      key: 'id'
    }
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  laboratoryRoom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  campus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  instructor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  laboratoryScheduleId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  attendanceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'attendance',
      key: 'id'
    }
  },
  usageStartTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  usageEndTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duration in minutes'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: "equipment_usage_logs",
  indexes: [
    { fields: ['studentId'] },
    { fields: ['equipmentId'] },
    { fields: ['serialNumber'] },
    { fields: ['usageStartTime'] }
  ]
});

export { sequelize };
```

### 2.3 EquipmentAuditTrail Model

Create: `/home/ubuntu/ComLab/models/equipmentAuditTrailModel.js`

```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const EquipmentAuditTrail = sequelize.define("EquipmentAuditTrail", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'equipment',
      key: 'id'
    }
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  actionType: {
    type: DataTypes.ENUM(
      'Created', 'Updated', 'StatusChanged', 'SetAssigned', 'SetRemoved',
      'Borrowed', 'Returned', 'ReportedMissing', 'ReportedDamaged',
      'MaintenanceStarted', 'MaintenanceCompleted', 'MarkedForDisposal',
      'Disposed', 'QRGenerated', 'InventoryChecked', 'Other'
    ),
    allowNull: false
  },
  actionDescription: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  previousValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON of previous state'
  },
  newValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON of new state'
  },
  performedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  performedByName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  performedByRole: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  relatedRecordType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'e.g., BorrowRecord, MaintenanceRequest'
  },
  relatedRecordId: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  tableName: "equipment_audit_trail",
  indexes: [
    { fields: ['equipmentId'] },
    { fields: ['serialNumber'] },
    { fields: ['actionType'] },
    { fields: ['createdAt'] },
    { fields: ['performedBy'] }
  ]
});

export { sequelize };
```

### 2.4 EquipmentInventoryCheck Model

Create: `/home/ubuntu/ComLab/models/equipmentInventoryCheckModel.js`

```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const EquipmentInventoryCheck = sequelize.define("EquipmentInventoryCheck", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  checkDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  campus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  laboratoryRoom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  checkedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  checkedByName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  totalEquipment: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  presentEquipment: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  missingEquipment: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  damagedEquipment: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('In Progress', 'Completed', 'Reviewed'),
    defaultValue: 'In Progress'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: "equipment_inventory_checks",
  indexes: [
    { fields: ['checkDate'] },
    { fields: ['campus', 'laboratoryRoom'] },
    { fields: ['checkedBy'] }
  ]
});

export const EquipmentInventoryCheckItem = sequelize.define("EquipmentInventoryCheckItem", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  inventoryCheckId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'equipment_inventory_checks',
      key: 'id'
    }
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'equipment',
      key: 'id'
    }
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  equipmentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  previousStatus: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  checkStatus: {
    type: DataTypes.ENUM('Present', 'Missing', 'Damaged', 'Needs Repair'),
    allowNull: false
  },
  condition: {
    type: DataTypes.ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional'),
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  photoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  tableName: "equipment_inventory_check_items",
  indexes: [
    { fields: ['inventoryCheckId'] },
    { fields: ['equipmentId'] }
  ]
});

export { sequelize };
```

### 2.5 EquipmentTechnicianReport Model

Create: `/home/ubuntu/ComLab/models/equipmentTechnicianReportModel.js`

```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const EquipmentTechnicianReport = sequelize.define("EquipmentTechnicianReport", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  reportNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'equipment',
      key: 'id'
    }
  },
  serialNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  setId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  reportType: {
    type: DataTypes.ENUM('Borrowed', 'Returned', 'Damaged', 'Missing', 'Malfunction', 'Repair Needed', 'Other'),
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Medium'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  reportedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reportedByName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  campus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  laboratoryRoom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  incidentDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  relatedStudentId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'If student-related incident'
  },
  relatedStudentName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  actionTaken: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'),
    defaultValue: 'Pending'
  },
  acknowledgedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  photoUrls: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of photo URLs'
  }
}, {
  timestamps: true,
  tableName: "equipment_technician_reports",
  indexes: [
    { fields: ['reportNumber'] },
    { fields: ['equipmentId'] },
    { fields: ['reportType'] },
    { fields: ['status'] },
    { fields: ['incidentDate'] }
  ]
});

export { sequelize };
```

---

## 3. Model Updates

### 3.1 Update Equipment Model

Update: `/home/ubuntu/ComLab/models/equipmentModel.js`

Add these fields to the Equipment model:

```javascript
// Add after existing fields
serialNumber: {
  type: DataTypes.STRING(100),
  allowNull: true,
  unique: true,
  comment: 'Unique serial number for individual equipment'
},
setId: {
  type: DataTypes.STRING(50),
  allowNull: true,
  comment: 'FK to equipment_sets.setId'
},
manufacturer: {
  type: DataTypes.STRING,
  allowNull: true
},
model: {
  type: DataTypes.STRING,
  allowNull: true
},
purchaseDate: {
  type: DataTypes.DATEONLY,
  allowNull: true
},
warrantyExpiry: {
  type: DataTypes.DATEONLY,
  allowNull: true
},
lastMaintenanceDate: {
  type: DataTypes.DATEONLY,
  allowNull: true
},
nextMaintenanceDate: {
  type: DataTypes.DATEONLY,
  allowNull: true
},
condition: {
  type: DataTypes.ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional'),
  defaultValue: 'Good'
},
location: {
  type: DataTypes.STRING(500),
  allowNull: true,
  comment: 'Specific location within lab'
},
remarks: {
  type: DataTypes.TEXT,
  allowNull: true
}
```

Update status enum:

```javascript
status: {
  type: DataTypes.ENUM(
    "Operational", "In Use", "Available", 
    "Missing", "For Repair", "Under Maintenance", 
    "For Disposal", "Disposed", 
    "Serviceable", "Unserviceable", "Lost" // Keep for backwards compatibility
  ),
  allowNull: false,
  defaultValue: "Operational"
}
```

### 3.2 Update Attendance Model

Update: `/home/ubuntu/ComLab/models/attendanceModel.js`

Add these fields:

```javascript
// Add after laboratoryScheduleId
equipmentId: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: 'Equipment/PC used by student'
},
serialNumber: {
  type: DataTypes.STRING(100),
  allowNull: true
},
setId: {
  type: DataTypes.STRING(50),
  allowNull: true
},
stationNumber: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: 'Physical station number'
}
```

### 3.3 Update BorrowRecord Model

Update: `/home/ubuntu/ComLab/models/borrowRecordModel.js`

Add these fields:

```javascript
// Add after equipmentId
serialNumber: {
  type: DataTypes.STRING(100),
  allowNull: true
},
setId: {
  type: DataTypes.STRING(50),
  allowNull: true
},
// Add after condition
returnCondition: {
  type: DataTypes.ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Damaged'),
  allowNull: true
},
damageDescription: {
  type: DataTypes.TEXT,
  allowNull: true
},
returnPhotoUrl: {
  type: DataTypes.STRING(500),
  allowNull: true
}
```

---

## 4. Controller Enhancements

### 4.1 New Equipment Set Controller

Create: `/home/ubuntu/ComLab/controllers/equipmentSetController.js`

**Functions to implement:**
- `getEquipmentSets()` - List all sets with status
- `getEquipmentSetById()` - Get set details with all equipment
- `createEquipmentSet()` - Create new set
- `updateEquipmentSet()` - Update set details
- `deleteEquipmentSet()` - Remove set
- `getSetStatus()` - Check if set is complete/incomplete
- `assignEquipmentToSet()` - Add equipment to set
- `removeEquipmentFromSet()` - Remove equipment from set
- `getMissingEquipmentInSet()` - List missing equipment in set

### 4.2 Equipment Usage Tracking Controller

Create: `/home/ubuntu/ComLab/controllers/equipmentUsageController.js`

**Functions to implement:**
- `recordEquipmentUsage()` - Log equipment usage (called during attendance)
- `getStudentUsageHistory()` - Get usage history for a student
- `getEquipmentUsageHistory()` - Get usage history for equipment
- `getActiveUsages()` - Get currently in-use equipment
- `endEquipmentUsage()` - Mark equipment usage as ended
- `getUsageStatistics()` - Generate usage reports

### 4.3 Audit Trail Controller

Create: `/home/ubuntu/ComLab/controllers/equipmentAuditController.js`

**Functions to implement:**
- `logAuditTrail()` - Create audit log entry (called from other controllers)
- `getEquipmentAuditTrail()` - Get audit trail for specific equipment
- `getAuditTrailByDateRange()` - Filter by date
- `getAuditTrailByUser()` - Filter by user
- `getAuditTrailByAction()` - Filter by action type
- `exportAuditTrail()` - Export to CSV/PDF

### 4.4 Inventory Check Controller

Create: `/home/ubuntu/ComLab/controllers/inventoryCheckController.js`

**Functions to implement:**
- `createInventoryCheck()` - Start new inventory check
- `getInventoryChecks()` - List all checks
- `getInventoryCheckById()` - Get check details
- `addCheckItem()` - Add equipment to check
- `updateCheckItem()` - Update equipment status during check
- `completeInventoryCheck()` - Finalize check
- `reviewInventoryCheck()` - Admin review
- `generateInventoryReport()` - Create report

### 4.5 Technician Report Controller

Create: `/home/ubuntu/ComLab/controllers/technicianReportController.js`

**Functions to implement:**
- `createTechnicianReport()` - Submit new report
- `getTechnicianReports()` - List reports
- `getReportById()` - Get report details
- `updateReport()` - Update report
- `acknowledgeReport()` - Admin acknowledges report
- `resolveReport()` - Mark as resolved
- `closeReport()` - Close report

### 4.6 Enhanced Equipment Controller

Update: `/home/ubuntu/ComLab/controllers/equipmentController.js`

**New functions to add:**
- `generateSerialNumber()` - Auto-generate serial numbers
- `getEquipmentBySerialNumber()` - Search by serial
- `getEquipmentsBySet()` - Get all equipment in a set
- `updateEquipmentStatus()` - Enhanced with audit trail
- `markEquipmentMissing()` - Special handling for missing equipment
- `getEquipmentHistory()` - Complete history (usage + maintenance + audit)

---

## 5. Frontend Updates

### 5.1 New Pages to Create

#### **Admin Dashboard - Equipment Audit Trail**
- Path: `/admin/equipment-audit-trail`
- Features:
  - Filter by equipment, date range, user, action type
  - Timeline view of activities
  - Export functionality
  - Detailed action logs

#### **Technician - Equipment Set Management**
- Path: `/technician/equipment-sets`
- Features:
  - List all sets with status indicators
  - View set details with equipment list
  - Mark equipment as missing/damaged
  - Quick status updates

#### **Technician - Weekly Inventory**
- Path: `/technician/inventory-check`
- Features:
  - Start new inventory check
  - Scan/search equipment
  - Mark status (Present/Missing/Damaged)
  - Take photos
  - Submit report

#### **Technician - Equipment Reports**
- Path: `/technician/equipment-reports`
- Features:
  - Create incident reports
  - Upload photos
  - Track report status
  - View report history

#### **Admin - Equipment Usage History**
- Path: `/admin/equipment-usage-history`
- Features:
  - Search by equipment or student
  - View usage timeline
  - Generate usage reports
  - Export data

#### **Admin - Set Monitoring**
- Path: `/admin/equipment-sets-monitor`
- Features:
  - Overview of all sets
  - Status dashboard (Complete/Incomplete)
  - Missing equipment alerts
  - Quick actions

### 5.2 Enhanced Existing Pages

#### **Equipment Inventory Page**
Add:
- Serial Number column
- Set ID column
- Condition indicator
- Quick status change
- View history button

#### **Equipment Detail Page**
Add:
- Serial Number display
- Set information
- Usage history section
- Maintenance history section
- Audit trail section
- QR code for serial number

#### **Attendance Page (Student)**
Add:
- Equipment/Station selection during time-in
- Show assigned equipment
- Equipment usage tracking

#### **Borrow Equipment Page**
Add:
- Serial Number selection
- Set information display
- Equipment condition check
- Return condition assessment

---

## 6. Implementation Phases

### Phase 1: Database Setup (Week 1)
**Goal:** Prepare database structure

**Tasks:**
1. Create migration script for new tables
2. Add columns to existing tables
3. Create indexes
4. Test migration on development database
5. Create rollback script
6. Backup production database

**Deliverables:**
- ✅ Migration SQL script
- ✅ Rollback script
- ✅ Database backup

### Phase 2: Core Models (Week 1-2)
**Goal:** Implement data models

**Tasks:**
1. Create all new models
2. Update existing models
3. Define relationships
4. Add validations
5. Write model tests

**Deliverables:**
- ✅ All model files created
- ✅ Model relationships defined
- ✅ Basic CRUD tests passing

### Phase 3: Serial Number & Set Management (Week 2-3)
**Goal:** Implement core tracking features

**Tasks:**
1. Serial number generation logic
2. Equipment set CRUD operations
3. Set assignment/removal logic
4. Set status calculation
5. Missing equipment tracking

**Deliverables:**
- ✅ Serial number auto-generation working
- ✅ Set management functional
- ✅ Equipment can be assigned to sets

### Phase 4: Audit Trail System (Week 3)
**Goal:** Implement activity logging

**Tasks:**
1. Audit trail logging middleware
2. Integrate with equipment operations
3. Create audit trail viewer
4. Implement filters
5. Export functionality

**Deliverables:**
- ✅ All equipment operations logged
- ✅ Audit trail viewable by admin
- ✅ Export to CSV working

### Phase 5: Usage Tracking (Week 4)
**Goal:** Student-to-equipment tracking

**Tasks:**
1. Integrate with attendance system
2. Equipment usage logging
3. Usage history viewer
4. Usage statistics
5. Reports generation

**Deliverables:**
- ✅ Equipment usage recorded during attendance
- ✅ Usage history viewable
- ✅ Reports functional

### Phase 6: Inventory Management (Week 4-5)
**Goal:** Weekly inventory checking

**Tasks:**
1. Inventory check creation
2. Equipment scanning/marking
3. Photo upload
4. Status updates
5. Report generation

**Deliverables:**
- ✅ Technicians can conduct inventory
- ✅ Equipment status updated
- ✅ Inventory reports generated

### Phase 7: Technician Reports (Week 5)
**Goal:** Incident reporting system

**Tasks:**
1. Report creation form
2. Report management
3. Status workflow
4. Photo upload
5. Notifications

**Deliverables:**
- ✅ Technicians can submit reports
- ✅ Admins can review reports
- ✅ Report tracking working

### Phase 8: Frontend Integration (Week 6-7)
**Goal:** Complete UI implementation

**Tasks:**
1. Create all new pages
2. Enhance existing pages
3. Add filters and search
4. Implement charts/graphs
5. Mobile responsiveness

**Deliverables:**
- ✅ All pages created
- ✅ UI/UX consistent
- ✅ Mobile-friendly

### Phase 9: Testing & QA (Week 7-8)
**Goal:** Ensure quality and stability

**Tasks:**
1. Unit testing
2. Integration testing
3. User acceptance testing
4. Performance testing
5. Security testing
6. Bug fixes

**Deliverables:**
- ✅ All tests passing
- ✅ Known bugs fixed
- ✅ Performance acceptable

### Phase 10: Deployment (Week 8)
**Goal:** Go live with new features

**Tasks:**
1. Database migration
2. Code deployment
3. Data verification
4. User training
5. Documentation
6. Monitoring

**Deliverables:**
- ✅ System live
- ✅ Users trained
- ✅ Documentation complete

---

## 7. Testing Plan

### 7.1 Unit Tests

**Equipment Set Management:**
- ✅ Create set with auto-generated setId
- ✅ Add equipment to set
- ✅ Remove equipment from set
- ✅ Calculate set status (Complete/Incomplete)
- ✅ Identify missing equipment in set

**Serial Number Generation:**
- ✅ Generate unique serial numbers
- ✅ Validate serial number format
- ✅ Prevent duplicate serial numbers
- ✅ Associate serial number with equipment

**Audit Trail:**
- ✅ Log equipment creation
- ✅ Log equipment updates
- ✅ Log status changes
- ✅ Log borrowing/returning
- ✅ Log maintenance activities

**Usage Tracking:**
- ✅ Record equipment usage
- ✅ Link to attendance record
- ✅ Calculate duration
- ✅ End usage session

### 7.2 Integration Tests

**Attendance + Equipment Usage:**
- ✅ Student scans QR → Attendance created + Equipment usage logged
- ✅ Student time-out → Equipment usage ended

**Borrowing + Audit Trail:**
- ✅ Borrow request → Audit trail logged
- ✅ Return equipment → Status updated + Audit logged

**Inventory Check + Status Updates:**
- ✅ Mark equipment as missing → Status updated + Audit logged
- ✅ Mark equipment as damaged → Maintenance request created

### 7.3 User Acceptance Tests

**Technician Workflow:**
- ✅ Conduct weekly inventory check
- ✅ Report missing equipment
- ✅ Submit damage report
- ✅ Track equipment in sets

**Admin Workflow:**
- ✅ View audit trail
- ✅ Monitor equipment sets
- ✅ Generate usage reports
- ✅ Review technician reports

**Student Workflow:**
- ✅ Select equipment during time-in
- ✅ View equipment usage history
- ✅ Borrow equipment with serial number

---

## 8. Migration Strategy

### 8.1 Data Migration

**Existing Equipment:**
1. Generate serial numbers for all existing equipment
2. Leave setId NULL initially (to be assigned manually)
3. Default status mapping:
   - Serviceable → Operational
   - Unserviceable → For Repair
   - Lost → Missing
4. Default condition: 'Good'

**Existing Borrow Records:**
1. Add serial numbers where equipment can be identified
2. Leave setId NULL if not applicable

### 8.2 Rollback Plan

**If migration fails:**
1. Run rollback script to remove new columns
2. Drop new tables
3. Restore from backup if data corruption
4. Redeploy previous version

### 8.3 Backwards Compatibility

**Ensure:**
- ✅ Existing queries still work
- ✅ New columns are nullable
- ✅ Default values provided
- ✅ No breaking changes to APIs
- ✅ Old equipment IDs still valid

---

## Appendix A: SQL Migration Script

### Full Migration Script

Save as: `/home/ubuntu/ComLab/migrations/equipment_enhancement_migration.sql`

```sql
-- ============================================================
-- ComLab Equipment Management Enhancement Migration
-- Version: 1.0.0
-- Date: 2026-09-20
-- ============================================================

-- Backup reminder
SELECT 'REMINDER: Ensure database backup is completed before running this migration!' AS WARNING;

-- Start transaction
START TRANSACTION;

-- ============================================================
-- 1. CREATE NEW TABLES
-- ============================================================

-- 1.1 Equipment Sets
CREATE TABLE IF NOT EXISTS `equipment_sets` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `setId` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `stationNumber` INT NULL,
  `description` TEXT NULL,
  `status` ENUM('Complete', 'Incomplete', 'Maintenance', 'Decommissioned') DEFAULT 'Complete',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_campus_lab` (`campus`, `laboratoryRoom`),
  INDEX `idx_setId` (`setId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.2 Equipment Usage Logs
CREATE TABLE IF NOT EXISTS `equipment_usage_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(255) NOT NULL,
  `studentName` VARCHAR(255) NOT NULL,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `instructor` VARCHAR(255) NULL,
  `laboratoryScheduleId` INT NULL,
  `attendanceId` INT NULL,
  `usageStartTime` DATETIME NOT NULL,
  `usageEndTime` DATETIME NULL,
  `duration` INT NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_student` (`studentId`),
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_serial` (`serialNumber`),
  INDEX `idx_date` (`usageStartTime`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`attendanceId`) REFERENCES `attendance`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.3 Equipment Audit Trail
CREATE TABLE IF NOT EXISTS `equipment_audit_trail` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `actionType` ENUM(
    'Created', 'Updated', 'StatusChanged', 'SetAssigned', 'SetRemoved',
    'Borrowed', 'Returned', 'ReportedMissing', 'ReportedDamaged',
    'MaintenanceStarted', 'MaintenanceCompleted', 'MarkedForDisposal',
    'Disposed', 'QRGenerated', 'InventoryChecked', 'Other'
  ) NOT NULL,
  `actionDescription` TEXT NOT NULL,
  `previousValue` TEXT NULL,
  `newValue` TEXT NULL,
  `performedBy` INT NOT NULL,
  `performedByName` VARCHAR(255) NOT NULL,
  `performedByRole` VARCHAR(50) NOT NULL,
  `ipAddress` VARCHAR(50) NULL,
  `userAgent` TEXT NULL,
  `relatedRecordType` VARCHAR(100) NULL,
  `relatedRecordId` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_serial` (`serialNumber`),
  INDEX `idx_action` (`actionType`),
  INDEX `idx_date` (`createdAt`),
  INDEX `idx_user` (`performedBy`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.4 Equipment Inventory Checks
CREATE TABLE IF NOT EXISTS `equipment_inventory_checks` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checkDate` DATE NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `checkedBy` INT NOT NULL,
  `checkedByName` VARCHAR(255) NOT NULL,
  `totalEquipment` INT NOT NULL DEFAULT 0,
  `presentEquipment` INT NOT NULL DEFAULT 0,
  `missingEquipment` INT NOT NULL DEFAULT 0,
  `damagedEquipment` INT NOT NULL DEFAULT 0,
  `status` ENUM('In Progress', 'Completed', 'Reviewed') DEFAULT 'In Progress',
  `remarks` TEXT NULL,
  `completedAt` DATETIME NULL,
  `reviewedBy` INT NULL,
  `reviewedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_date` (`checkDate`),
  INDEX `idx_campus_lab` (`campus`, `laboratoryRoom`),
  INDEX `idx_technician` (`checkedBy`),
  FOREIGN KEY (`checkedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.5 Equipment Inventory Check Items
CREATE TABLE IF NOT EXISTS `equipment_inventory_check_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `inventoryCheckId` INT NOT NULL,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `equipmentName` VARCHAR(255) NOT NULL,
  `previousStatus` VARCHAR(50) NOT NULL,
  `checkStatus` ENUM('Present', 'Missing', 'Damaged', 'Needs Repair') NOT NULL,
  `condition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional') NULL,
  `remarks` TEXT NULL,
  `photoUrl` VARCHAR(500) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_check` (`inventoryCheckId`),
  INDEX `idx_equipment` (`equipmentId`),
  FOREIGN KEY (`inventoryCheckId`) REFERENCES `equipment_inventory_checks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.6 Equipment Technician Reports
CREATE TABLE IF NOT EXISTS `equipment_technician_reports` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `reportNumber` VARCHAR(50) NOT NULL UNIQUE,
  `equipmentId` INT NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `setId` VARCHAR(50) NULL,
  `reportType` ENUM('Borrowed', 'Returned', 'Damaged', 'Missing', 'Malfunction', 'Repair Needed', 'Other') NOT NULL,
  `priority` ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
  `description` TEXT NOT NULL,
  `reportedBy` INT NOT NULL,
  `reportedByName` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(255) NOT NULL,
  `laboratoryRoom` VARCHAR(255) NOT NULL,
  `incidentDate` DATETIME NOT NULL,
  `relatedStudentId` VARCHAR(255) NULL,
  `relatedStudentName` VARCHAR(255) NULL,
  `actionTaken` TEXT NULL,
  `resolution` TEXT NULL,
  `status` ENUM('Pending', 'Acknowledged', 'In Progress', 'Resolved', 'Closed') DEFAULT 'Pending',
  `acknowledgedBy` INT NULL,
  `acknowledgedAt` DATETIME NULL,
  `resolvedAt` DATETIME NULL,
  `photoUrls` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_report_number` (`reportNumber`),
  INDEX `idx_equipment` (`equipmentId`),
  INDEX `idx_type` (`reportType`),
  INDEX `idx_status` (`status`),
  INDEX `idx_date` (`incidentDate`),
  FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reportedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================

-- 2.1 Update equipment table
ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `serialNumber` VARCHAR(100) NULL UNIQUE AFTER `equipmentId`,
ADD COLUMN IF NOT EXISTS `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN IF NOT EXISTS `manufacturer` VARCHAR(255) NULL AFTER `category`,
ADD COLUMN IF NOT EXISTS `model` VARCHAR(255) NULL AFTER `manufacturer`,
ADD COLUMN IF NOT EXISTS `purchaseDate` DATE NULL AFTER `dateAdded`,
ADD COLUMN IF NOT EXISTS `warrantyExpiry` DATE NULL AFTER `purchaseDate`,
ADD COLUMN IF NOT EXISTS `lastMaintenanceDate` DATE NULL,
ADD COLUMN IF NOT EXISTS `nextMaintenanceDate` DATE NULL,
ADD COLUMN IF NOT EXISTS `condition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional') DEFAULT 'Good',
ADD COLUMN IF NOT EXISTS `location` VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS `remarks` TEXT NULL;

-- Add indexes
ALTER TABLE `equipment`
ADD INDEX IF NOT EXISTS `idx_serialNumber` (`serialNumber`),
ADD INDEX IF NOT EXISTS `idx_setId` (`setId`);

-- Update status enum (may need to handle differently based on MySQL version)
-- ALTER TABLE `equipment` 
-- MODIFY COLUMN `status` ENUM(
--   'Operational', 'In Use', 'Available', 
--   'Missing', 'For Repair', 'Under Maintenance', 
--   'For Disposal', 'Disposed', 
--   'Serviceable', 'Unserviceable', 'Lost'
-- ) DEFAULT 'Operational';

-- 2.2 Update attendance table
ALTER TABLE `attendance`
ADD COLUMN IF NOT EXISTS `equipmentId` INT NULL AFTER `laboratoryScheduleId`,
ADD COLUMN IF NOT EXISTS `serialNumber` VARCHAR(100) NULL AFTER `equipmentId`,
ADD COLUMN IF NOT EXISTS `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN IF NOT EXISTS `stationNumber` INT NULL AFTER `setId`;

-- Add indexes
ALTER TABLE `attendance`
ADD INDEX IF NOT EXISTS `idx_equipment` (`equipmentId`),
ADD INDEX IF NOT EXISTS `idx_serial` (`serialNumber`);

-- 2.3 Update borrow_records table
ALTER TABLE `borrow_records`
ADD COLUMN IF NOT EXISTS `serialNumber` VARCHAR(100) NULL AFTER `equipmentId`,
ADD COLUMN IF NOT EXISTS `setId` VARCHAR(50) NULL AFTER `serialNumber`,
ADD COLUMN IF NOT EXISTS `returnCondition` ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Damaged') NULL AFTER `condition`,
ADD COLUMN IF NOT EXISTS `damageDescription` TEXT NULL AFTER `returnCondition`,
ADD COLUMN IF NOT EXISTS `returnPhotoUrl` VARCHAR(500) NULL AFTER `damageDescription`;

-- Add indexes
ALTER TABLE `borrow_records`
ADD INDEX IF NOT EXISTS `idx_serial` (`serialNumber`);

-- 2.4 Update maintenance_requests table (if exists)
-- ALTER TABLE `maintenance_requests`
-- ADD COLUMN IF NOT EXISTS `serialNumber` VARCHAR(100) NULL AFTER `equipment_id`,
-- ADD COLUMN IF NOT EXISTS `setId` VARCHAR(50) NULL AFTER `serialNumber`,
-- ADD COLUMN IF NOT EXISTS `partsReplaced` TEXT NULL,
-- ADD COLUMN IF NOT EXISTS `maintenanceCost` DECIMAL(10,2) NULL DEFAULT 0,
-- ADD COLUMN IF NOT EXISTS `completionNotes` TEXT NULL;

-- ============================================================
-- 3. DATA MIGRATION (Generate Serial Numbers)
-- ============================================================

-- Generate serial numbers for existing equipment without serial numbers
-- Format: SN-{campus_prefix}-{category_prefix}-{sequential_number}
-- Example: SN-BON-CPU-0001

SET @row_number = 0;

UPDATE equipment 
SET serialNumber = CONCAT(
  'SN-',
  CASE 
    WHEN campus LIKE '%Bongabong%' THEN 'BON'
    WHEN campus LIKE '%Calapan%' THEN 'CAL'
    WHEN campus LIKE '%Victoria%' THEN 'VIC'
    ELSE 'GEN'
  END,
  '-',
  SUBSTRING(category, 1, 3),
  '-',
  LPAD((@row_number := @row_number + 1), 4, '0')
)
WHERE serialNumber IS NULL OR serialNumber = '';

-- ============================================================
-- 4. VERIFY MIGRATION
-- ============================================================

-- Check new tables
SELECT 'Verifying new tables...' AS Status;
SELECT COUNT(*) AS equipment_sets_count FROM equipment_sets;
SELECT COUNT(*) AS usage_logs_count FROM equipment_usage_logs;
SELECT COUNT(*) AS audit_trail_count FROM equipment_audit_trail;
SELECT COUNT(*) AS inventory_checks_count FROM equipment_inventory_checks;
SELECT COUNT(*) AS check_items_count FROM equipment_inventory_check_items;
SELECT COUNT(*) AS tech_reports_count FROM equipment_technician_reports;

-- Check updated columns
SELECT 'Verifying equipment table updates...' AS Status;
SELECT COUNT(*) AS equipment_with_serial FROM equipment WHERE serialNumber IS NOT NULL;
SELECT COUNT(*) AS equipment_without_serial FROM equipment WHERE serialNumber IS NULL;

SELECT 'Verifying attendance table updates...' AS Status;
SHOW COLUMNS FROM attendance LIKE 'equipmentId';
SHOW COLUMNS FROM attendance LIKE 'serialNumber';

SELECT 'Verifying borrow_records table updates...' AS Status;
SHOW COLUMNS FROM borrow_records LIKE 'serialNumber';
SHOW COLUMNS FROM borrow_records LIKE 'returnCondition';

-- ============================================================
-- 5. COMMIT OR ROLLBACK
-- ============================================================

-- Review the verification results above
-- If everything looks good:
COMMIT;

-- If there are issues:
-- ROLLBACK;

SELECT '✅ Migration completed successfully!' AS Result;
SELECT 'Remember to test all features before deploying to production!' AS Reminder;
```

---

## Appendix B: Rollback Script

Save as: `/home/ubuntu/ComLab/migrations/equipment_enhancement_rollback.sql`

```sql
-- ============================================================
-- ComLab Equipment Management Enhancement Rollback Script
-- Version: 1.0.0
-- Date: 2026-09-20
-- ============================================================

START TRANSACTION;

-- Drop new tables in reverse order (respect foreign keys)
DROP TABLE IF EXISTS `equipment_inventory_check_items`;
DROP TABLE IF EXISTS `equipment_inventory_checks`;
DROP TABLE IF EXISTS `equipment_technician_reports`;
DROP TABLE IF EXISTS `equipment_usage_logs`;
DROP TABLE IF EXISTS `equipment_audit_trail`;
DROP TABLE IF EXISTS `equipment_sets`;

-- Remove added columns from existing tables
ALTER TABLE `equipment`
DROP COLUMN IF EXISTS `remarks`,
DROP COLUMN IF EXISTS `location`,
DROP COLUMN IF EXISTS `condition`,
DROP COLUMN IF EXISTS `nextMaintenanceDate`,
DROP COLUMN IF EXISTS `lastMaintenanceDate`,
DROP COLUMN IF EXISTS `warrantyExpiry`,
DROP COLUMN IF EXISTS `purchaseDate`,
DROP COLUMN IF EXISTS `model`,
DROP COLUMN IF EXISTS `manufacturer`,
DROP COLUMN IF EXISTS `setId`,
DROP COLUMN IF EXISTS `serialNumber`;

ALTER TABLE `attendance`
DROP COLUMN IF EXISTS `stationNumber`,
DROP COLUMN IF EXISTS `setId`,
DROP COLUMN IF EXISTS `serialNumber`,
DROP COLUMN IF EXISTS `equipmentId`;

ALTER TABLE `borrow_records`
DROP COLUMN IF EXISTS `returnPhotoUrl`,
DROP COLUMN IF EXISTS `damageDescription`,
DROP COLUMN IF EXISTS `returnCondition`,
DROP COLUMN IF EXISTS `setId`,
DROP COLUMN IF EXISTS `serialNumber`;

COMMIT;

SELECT '✅ Rollback completed successfully!' AS Result;
```

---

## Appendix C: Testing Checklist

### Pre-Deployment Testing

**Database:**
- [ ] Migration runs without errors
- [ ] All tables created successfully
- [ ] Indexes created properly
- [ ] Foreign keys working
- [ ] Serial numbers generated for existing equipment
- [ ] Rollback script tested

**Models:**
- [ ] All models load without errors
- [ ] Relationships defined correctly
- [ ] Validations working
- [ ] CRUD operations functional

**Controllers:**
- [ ] All endpoints return correct responses
- [ ] Error handling works
- [ ] Authentication/authorization enforced
- [ ] Audit trail logging works

**Frontend:**
- [ ] All pages load correctly
- [ ] Forms submit successfully
- [ ] Data displays properly
- [ ] Filters work
- [ ] Export functions work
- [ ] Mobile responsive

**Integration:**
- [ ] Attendance creates usage log
- [ ] Equipment operations create audit trail
- [ ] Reports generate correctly
- [ ] Notifications sent

**Performance:**
- [ ] Page load times acceptable
- [ ] Database queries optimized
- [ ] No N+1 query problems
- [ ] Large datasets handled well

**Security:**
- [ ] Role-based access working
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] CSRF tokens validated
- [ ] File uploads validated

---

**END OF IMPLEMENTATION PLAN**

This plan provides a comprehensive roadmap for implementing all requested equipment management enhancements while maintaining system stability and backwards compatibility.
