# Equipment Management Enhancement - Quick Start Guide

**🚀 Get Started in 30 Minutes**

This guide will help you start implementing the equipment tracking enhancements immediately.

---

## Prerequisites

- ✅ Server access (SSH)
- ✅ Database backup completed
- ✅ PM2 and Node.js installed
- ✅ Basic understanding of the codebase

---

## Step 1: Backup Database (5 minutes)

```bash
# SSH into server
ssh ubuntu@3.24.93.0

# Create backup directory
mkdir -p /home/ubuntu/backups

# Backup database
mysqldump -u comlab -pcomlab123 comlab > /home/ubuntu/backups/comlab_before_enhancement_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh /home/ubuntu/backups/
```

---

## Step 2: Run Database Migration (10 minutes)

```bash
# Go to project directory
cd /home/ubuntu/ComLab

# Create migrations directory
mkdir -p migrations

# Copy the migration script (already created in IMPLEMENTATION_PLAN.md)
# You'll need to extract the SQL from Appendix A

# Or run this quick version:
mysql -u comlab -pcomlab123 comlab << 'EOF'

-- Create equipment_sets table
CREATE TABLE IF NOT EXISTS equipment_sets (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setId VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  laboratoryRoom VARCHAR(255) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  stationNumber INT NULL,
  description TEXT NULL,
  status ENUM('Complete', 'Incomplete', 'Maintenance', 'Decommissioned') DEFAULT 'Complete',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_campus_lab (campus, laboratoryRoom),
  INDEX idx_setId (setId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add serial number to equipment table
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS serialNumber VARCHAR(100) NULL UNIQUE AFTER equipmentId,
ADD COLUMN IF NOT EXISTS setId VARCHAR(50) NULL AFTER serialNumber,
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255) NULL AFTER category,
ADD COLUMN IF NOT EXISTS model VARCHAR(255) NULL AFTER manufacturer,
ADD COLUMN IF NOT EXISTS condition ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional') DEFAULT 'Good',
ADD COLUMN IF NOT EXISTS location VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS remarks TEXT NULL;

-- Generate serial numbers for existing equipment
SET @row_number = 0;
UPDATE equipment 
SET serialNumber = CONCAT('SN-', LPAD((@row_number := @row_number + 1), 6, '0'))
WHERE serialNumber IS NULL;

SELECT 'Migration completed!' AS status;

EOF
```

---

## Step 3: Create Basic Models (10 minutes)

### Create Equipment Set Model

```bash
nano /home/ubuntu/ComLab/models/equipmentSetModel.js
```

Paste this:

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
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
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
    allowNull: true
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
  tableName: "equipment_sets"
});

export { sequelize };
```

Save: Ctrl+X, Y, Enter

---

## Step 4: Update Equipment Model (5 minutes)

```bash
nano /home/ubuntu/ComLab/models/equipmentModel.js
```

Add these fields after the existing `equipmentId` field:

```javascript
serialNumber: {
  type: DataTypes.STRING(100),
  allowNull: true,
  unique: true
},
setId: {
  type: DataTypes.STRING(50),
  allowNull: true
},
manufacturer: {
  type: DataTypes.STRING,
  allowNull: true
},
model: {
  type: DataTypes.STRING,
  allowNull: true
},
condition: {
  type: DataTypes.ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Non-functional'),
  defaultValue: 'Good'
},
location: {
  type: DataTypes.STRING(500),
  allowNull: true
},
remarks: {
  type: DataTypes.TEXT,
  allowNull: true
}
```

Save and exit.

---

## Step 5: Test the Changes (5 minutes)

```bash
# Restart the application
pm2 restart xianfires

# Check logs for errors
pm2 logs xianfires --lines 30

# Test database connection
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES;"
mysql -u comlab -pcomlab123 comlab -e "DESCRIBE equipment;"
mysql -u comlab -pcomlab123 comlab -e "SELECT COUNT(*) AS total, COUNT(serialNumber) AS with_serial FROM equipment;"
```

If no errors, you're good! ✅

---

## Step 6: Verify in Browser

1. Visit: https://comlabfacilitiesms.cyou
2. Login as admin
3. Go to Equipment Inventory
4. Check if equipment loads correctly
5. No errors? Success! 🎉

---

## Next Steps

Now that basic structure is in place, you can:

1. **Phase 1:** Implement equipment set management
2. **Phase 2:** Add audit trail logging
3. **Phase 3:** Create usage tracking
4. **Phase 4:** Build inventory checking
5. **Phase 5:** Add technician reports

Follow the **IMPLEMENTATION_PLAN.md** for detailed steps.

---

## Rollback (If Something Goes Wrong)

```bash
# Restore database from backup
mysql -u comlab -pcomlab123 comlab < /home/ubuntu/backups/comlab_before_enhancement_*.sql

# Restart application
pm2 restart xianfires
```

---

## Need Help?

Check these files:
- `IMPLEMENTATION_PLAN.md` - Complete implementation guide
- `SYSTEM_DOCUMENTATION.md` - System overview
- PM2 logs: `pm2 logs xianfires`
- MySQL logs: `sudo tail -f /var/log/mysql/error.log`

---

**You're all set! 🚀 Start building the enhanced features!**
