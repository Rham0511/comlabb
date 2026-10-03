# Equipment Enhancements Migration Guide

## Overview
This guide walks you through migrating the ComLab database to support the new equipment management features including serial numbers, equipment sets, usage tracking, audit trails, and more.

## ⚠️ Before You Start

### 1. Prerequisites
- [ ] Node.js and npm installed
- [ ] MySQL database running
- [ ] Current database backup
- [ ] Application stopped or in maintenance mode
- [ ] Read access to `.env` file

### 2. Backup Checklist
```bash
# Create manual backup (recommended)
mysqldump -u comlab -pcomlab123 comlab > /home/ubuntu/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file exists and has content
ls -lh /home/ubuntu/backups/
```

## 🚀 Migration Steps

### Step 1: Run the Migration Script
The automated migration script will:
- ✅ Create an automatic database backup
- ✅ Add 6 new tables
- ✅ Add 9 new columns to equipment table
- ✅ Create all necessary indexes
- ✅ Verify all changes

```bash
cd /home/ubuntu/ComLab
node run-migration.js
```

### Step 2: Verify Migration Success
Look for these success messages:
```
✅ Migration completed successfully!
✅ Database backup created
✅ 6 new tables created
✅ Equipment table enhanced with 9 new columns
```

### Step 3: Restart Application
```bash
pm2 restart xianfires
pm2 logs xianfires --lines 50
```

### Step 4: Test Basic Functionality
1. Login to the system: https://comlabfacilitiesms.cyou
2. Navigate to Equipment Inventory
3. Verify existing equipment still shows correctly
4. Try adding new equipment (should work as before)

## 📊 What Gets Created

### New Tables

#### 1. `equipment_sets`
Groups equipment that work together (e.g., PC workstation = monitor + CPU + keyboard + mouse)
- **Purpose**: Manage complete equipment sets
- **Key Fields**: `setId`, `setName`, `description`, `status`
- **Example**: PC-SET-CALAPAN-001 containing 4 pieces of equipment

#### 2. `equipment_usage_logs`
Tracks who used what equipment and when
- **Purpose**: Student-to-equipment traceability
- **Key Fields**: `userId`, `equipmentId`, `serialNumber`, `usageStartTime`, `usageEndTime`
- **Links To**: `attendance` table for complete accountability

#### 3. `equipment_audit_trail`
Complete audit log of all equipment actions
- **Purpose**: Compliance and accountability
- **Key Fields**: `actionType`, `performedBy`, `beforeState`, `afterState`, `actionTimestamp`
- **Tracks**: Created, updated, borrowed, returned, maintenance, status changes, etc.

#### 4. `equipment_inventory_checks`
Weekly inventory verification sessions
- **Purpose**: Physical equipment verification
- **Key Fields**: `checkId`, `checkDate`, `performedBy`, `missingCount`, `damagedCount`
- **Example**: INV-2026-W40 (Week 40 of 2026)

#### 5. `equipment_inventory_check_items`
Individual items checked during inventory
- **Purpose**: Detailed inventory results per equipment
- **Key Fields**: `status` (found/missing/damaged), `conditionBefore`, `conditionAfter`
- **Links To**: `equipment_inventory_checks`

#### 6. `equipment_technician_reports`
Weekly reports from technicians
- **Purpose**: Technician workflow and reporting
- **Key Fields**: `reportType`, `summary`, `recommendations`, `status`
- **Includes**: Maintenance performed, issues found, recommendations

### New Equipment Table Columns

| Column | Type | Purpose | Example |
|--------|------|---------|---------|
| `serialNumber` | VARCHAR(100) | Unique equipment identifier | PC-CALAPAN-2026-00001 |
| `setId` | VARCHAR(50) | Links to equipment set | PC-SET-CALAPAN-001 |
| `manufacturer` | VARCHAR(100) | Equipment maker | Dell, HP, Acer |
| `model` | VARCHAR(100) | Model number/name | OptiPlex 7090 |
| `purchaseDate` | DATE | When purchased | 2024-05-15 |
| `warrantyExpiry` | DATE | Warranty end date | 2027-05-15 |
| `condition` | ENUM | Physical condition | excellent, good, fair, poor, broken |
| `location` | VARCHAR(255) | Current location | Lab 1, Row 3, Station 5 |
| `remarks` | TEXT | Additional notes | Recently repaired keyboard |

## 🔄 Rollback Plan (If Needed)

If something goes wrong, you can restore from backup:

```bash
# Stop application
pm2 stop xianfires

# Restore from automatic backup (created by migration script)
mysql -u comlab -pcomlab123 comlab < /home/ubuntu/ComLab/backups/comlab_backup_YYYY-MM-DD.sql

# OR restore from manual backup
mysql -u comlab -pcomlab123 comlab < /home/ubuntu/backups/manual_backup_YYYYMMDD_HHMMSS.sql

# Restart application
pm2 start xianfires
```

## ✅ Post-Migration Verification

### Database Verification
```sql
-- Check new tables exist
SHOW TABLES LIKE 'equipment_%';

-- Check equipment table structure
DESCRIBE equipment;

-- Verify indexes
SHOW INDEX FROM equipment;

-- Count records (should match pre-migration count)
SELECT COUNT(*) FROM equipment;
```

### Application Verification
1. **Equipment List**: All existing equipment still visible
2. **Add Equipment**: Can add new equipment (with or without serial number)
3. **Edit Equipment**: Can edit existing equipment
4. **Borrow Equipment**: Borrowing workflow still works
5. **Attendance**: Student attendance system functional

## 📋 New Features Available After Migration

### For Admins
- ✨ Serial number auto-generation
- ✨ Equipment set management
- ✨ Complete audit trail viewing
- ✨ Weekly inventory check creation
- ✨ Technician report review

### For Technicians
- ✨ Weekly inventory checks
- ✨ Equipment condition tracking
- ✨ Missing equipment reporting
- ✨ Weekly report submission
- ✨ Maintenance history viewing

### For Faculty/Students
- ✨ Equipment usage history
- ✨ Equipment set availability checking
- ✨ Better equipment identification via serial numbers

## 🐛 Troubleshooting

### Migration Script Fails
**Error**: "Cannot connect to database"
**Solution**: Check `.env` file has correct database credentials

**Error**: "Table already exists"
**Solution**: This is normal if running migration twice. Script skips existing tables.

**Error**: "Duplicate column name"
**Solution**: This is normal if columns were already added. Script skips existing columns.

### Application Won't Start
**Solution**: Check PM2 logs
```bash
pm2 logs xianfires --lines 100
```

Look for errors related to:
- Database connection
- Model loading
- Missing dependencies

### Existing Equipment Not Showing
**Solution**: Check equipment table data
```sql
SELECT COUNT(*) FROM equipment;
SELECT * FROM equipment LIMIT 5;
```

If data is missing, restore from backup.

## 📞 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs xianfires`
2. Check MySQL error log: `sudo tail -f /var/log/mysql/error.log`
3. Verify database connection in `.env`
4. Ensure all dependencies installed: `npm install`

## 📅 Migration Record

**Migration File**: `001_equipment_enhancements.sql`
**Date Created**: 2026-09-30
**Tables Added**: 6
**Columns Added**: 9 (equipment table)
**Breaking Changes**: None - fully backwards compatible

---

## Next Steps

After successful migration:
1. Review [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for feature details
2. Review [FEATURE_SUMMARY.md](./FEATURE_SUMMARY.md) for user-facing features
3. Test new features in development/staging first
4. Train technicians on new inventory workflow
5. Configure weekly inventory schedule
6. Set up technician report workflow

**Migration Status**: ⏳ Ready to Run

Once completed, update this status to: ✅ Completed on [DATE]
