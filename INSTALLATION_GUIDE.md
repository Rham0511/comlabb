# Equipment Enhancements - Installation Guide

## 📋 Overview
This guide walks you through installing and testing the 12 new equipment management features for the ComLab system.

## 🎯 What You're Installing

### New Features
1. **Serial Number Tracking** - Unique identification for every equipment
2. **Equipment Sets Management** - Group equipment that work together
3. **Usage Tracking** - Know who used what equipment and when
4. **Complete Audit Trail** - Full accountability log
5. **Weekly Inventory Checks** - Physical verification workflow
6. **Technician Reporting** - Weekly report submission system

### New Components
- ✅ 6 new database tables
- ✅ 9 new equipment table columns
- ✅ 6 new Sequelize models
- ✅ 5 new controllers (50+ API endpoints)
- ✅ Audit logging utility
- ✅ Serial number generator utility
- ✅ Comprehensive API routes

## 🚀 Installation Steps

### Step 1: Backup Your System
```bash
cd /home/ubuntu/ComLab

# Create backup directory
mkdir -p backups

# Backup database
mysqldump -u comlab -pcomlab123 comlab > backups/pre_enhancement_$(date +%Y%m%d_%H%M%S).sql

# Backup application files (optional)
tar -czf backups/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  --exclude=node_modules \
  --exclude=backups \
  .
```

**Verify backup exists:**
```bash
ls -lh backups/
# Should show your backup files
```

### Step 2: Run Database Migration
```bash
cd /home/ubuntu/ComLab

# Option A: Use automated script (RECOMMENDED)
bash quick-migrate.sh

# Option B: Manual migration
node run-migration.js
```

**Expected Output:**
```
✅ Migration completed successfully!
✅ Database backup created
✅ 6 new tables created
✅ Equipment table enhanced with 9 new columns
```

### Step 3: Update Your Application Index/Server File

You need to register the new routes in your main application file. Add this to your `index.js` or main server file:

```javascript
// Import new routes
const equipmentEnhancementsRoutes = require('./routes/equipmentEnhancementsRoutes');

// Register routes (add after existing routes)
app.use('/api/equipment-enhancements', equipmentEnhancementsRoutes);
```

### Step 4: Restart Application
```bash
# Restart with PM2
pm2 restart xianfires

# Check status
pm2 status

# View logs
pm2 logs xianfires --lines 50
```

### Step 5: Verify Installation

#### Test 1: Health Check
```bash
curl -X GET http://localhost:3001/api/equipment-enhancements/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Equipment Enhancements API is running",
  "version": "1.0.0",
  "features": [
    "Serial Number Tracking",
    "Equipment Sets",
    "Usage Tracking",
    "Audit Trail",
    "Inventory Checks",
    "Technician Reports"
  ]
}
```

#### Test 2: Check Database Tables
```sql
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES LIKE 'equipment_%';"
```

**Expected Output:**
```
equipment
equipment_audit_trail
equipment_inventory_check_items
equipment_inventory_checks
equipment_sequences
equipment_sets
equipment_technician_reports
equipment_usage_logs
```

#### Test 3: Verify Equipment Table Columns
```sql
mysql -u comlab -pcomlab123 comlab -e "DESCRIBE equipment;"
```

**Should include new columns:**
- serialNumber
- setId
- manufacturer
- model
- purchaseDate
- warrantyExpiry
- condition
- location
- remarks

## 🧪 Testing the Features

### Test Equipment Sets

**Create a new equipment set:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/sets \
  -H "Content-Type: application/json" \
  -d '{
    "setName": "Computer Lab 1 - Station 1",
    "description": "Complete PC workstation with monitor, keyboard, and mouse",
    "campusId": 1,
    "laboratoryId": 1,
    "location": "Lab 1, Row 1, Station 1",
    "type": "PC"
  }'
```

**Get all equipment sets:**
```bash
curl -X GET http://localhost:3001/api/equipment-enhancements/sets
```

### Test Serial Number Generation

The serial number utility will auto-generate unique serial numbers. Test it:

```bash
node -e "
const { generateSerialNumber } = require('./utils/serialNumberGenerator');
generateSerialNumber('PC', 'CALAPAN').then(sn => console.log('Generated:', sn));
"
```

**Expected Output:**
```
Generated: PC-CALAPAN-2026-00001
```

### Test Audit Trail

**View recent audit activity:**
```bash
curl -X GET "http://localhost:3001/api/equipment-enhancements/audit/recent?limit=10"
```

### Test Usage Tracking

**Start a usage session:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/usage/start \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": 1,
    "userId": 1,
    "campusId": 1,
    "laboratoryId": 1
  }'
```

**Get active sessions:**
```bash
curl -X GET http://localhost:3001/api/equipment-enhancements/usage/active
```

### Test Inventory Checks

**Create weekly inventory check:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/inventory-checks \
  -H "Content-Type: application/json" \
  -d '{
    "campusId": 1,
    "laboratoryId": 1,
    "notes": "Weekly inventory check for Lab 1"
  }'
```

### Test Technician Reports

**Create a report:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/reports \
  -H "Content-Type: application/json" \
  -d '{
    "campusId": 1,
    "reportType": "weekly",
    "summary": "All equipment in good working condition this week",
    "equipmentIssuesCount": 2,
    "maintenancePerformed": 1,
    "recommendations": "Replace keyboard in Station 5"
  }'
```

## 🔧 Configuration

### Enable Auto Serial Number Generation

To automatically generate serial numbers when creating equipment, update your equipment controller to import and use the utility:

```javascript
const { generateSerialNumber } = require('../utils/serialNumberGenerator');

// In your create equipment function:
if (!serialNumber) {
  serialNumber = await generateSerialNumber(category, campus);
}
```

### Enable Audit Logging

Import the audit logger in your equipment controller:

```javascript
const {
  logEquipmentCreated,
  logEquipmentUpdated,
  logEquipmentDeleted
} = require('../utils/auditLogger');

// After creating equipment:
await logEquipmentCreated(equipment, req.user, req);

// After updating equipment:
await logEquipmentUpdated(equipmentBefore, equipmentAfter, req.user, req);
```

## 📊 Verify Everything Works

### Full System Check
```bash
# 1. Database tables
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES;"

# 2. Equipment columns
mysql -u comlab -pcomlab123 comlab -e "DESCRIBE equipment;"

# 3. API health check
curl http://localhost:3001/api/equipment-enhancements/health

# 4. Application logs
pm2 logs xianfires --lines 100

# 5. Database connectivity
mysql -u comlab -pcomlab123 comlab -e "SELECT COUNT(*) FROM equipment;"
```

## ⚠️ Troubleshooting

### Issue: Migration fails with "Table already exists"
**Solution:** This is normal if running migration twice. The script skips existing tables.

### Issue: "Cannot find module" errors
**Solution:** 
```bash
cd /home/ubuntu/ComLab
npm install
pm2 restart xianfires
```

### Issue: Routes return 404
**Solution:** Make sure you added the routes to your main server file:
```javascript
app.use('/api/equipment-enhancements', require('./routes/equipmentEnhancementsRoutes'));
```

### Issue: Database connection errors
**Solution:** Check `.env` file has correct credentials:
```bash
cat .env | grep DB_
```

### Issue: PM2 won't restart
**Solution:**
```bash
pm2 delete xianfires
pm2 start index.js --name xianfires
pm2 save
```

## 🔄 Rollback (If Needed)

If something goes wrong:

```bash
# 1. Stop application
pm2 stop xianfires

# 2. Restore database from backup
mysql -u comlab -pcomlab123 comlab < backups/pre_enhancement_YYYYMMDD_HHMMSS.sql

# 3. Restart application
pm2 start xianfires
```

## ✅ Post-Installation Checklist

- [ ] Database backup created
- [ ] Migration completed successfully
- [ ] All 6 new tables exist
- [ ] Equipment table has 9 new columns
- [ ] Application restarted without errors
- [ ] Health check endpoint returns success
- [ ] Can create equipment sets
- [ ] Can start/end usage sessions
- [ ] Audit trail is logging actions
- [ ] Inventory checks can be created
- [ ] Technician reports can be created

## 📚 Next Steps

1. **Review API Documentation**: See all available endpoints in `routes/equipmentEnhancementsRoutes.js`
2. **Integrate with Frontend**: Update your HTML/JS files to use new features
3. **Configure Permissions**: Set up role-based access for technicians and admins
4. **Train Users**: Familiarize technicians with new workflows
5. **Monitor Logs**: Watch PM2 logs for any issues

## 📞 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs xianfires`
2. Check MySQL error log: `sudo tail -f /var/log/mysql/error.log`
3. Review migration guide: `MIGRATION_GUIDE.md`
4. Check implementation plan: `IMPLEMENTATION_PLAN.md`

---

**Installation Date**: _______________  
**Installed By**: _______________  
**Version**: 1.0.0  
**Status**: ⏳ Pending / ✅ Completed
