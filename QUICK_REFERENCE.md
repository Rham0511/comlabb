# ComLab Enhancements - Quick Reference Card

## 🚀 Quick Deploy (5 Minutes)

```bash
# 1. Backup
mysqldump -u comlab -pcomlab123 comlab > backups/backup_$(date +%Y%m%d).sql

# 2. Migrate
bash quick-migrate.sh

# 3. Restart
pm2 restart xianfires

# 4. Test
curl http://localhost:3001/api/equipment-enhancements/health
```

## 📁 New Files Created

### Database
- `migrations/001_equipment_enhancements.sql`

### Models (6)
- `equipmentSetModel.js`
- `equipmentUsageLogModel.js`
- `equipmentAuditTrailModel.js`
- `equipmentInventoryCheckModel.js`
- `equipmentInventoryCheckItemModel.js`
- `equipmentTechnicianReportModel.js`

### Controllers (5)
- `equipmentSetController.js`
- `inventoryCheckController.js`
- `usageTrackingController.js`
- `auditTrailController.js`
- `technicianReportController.js`

### Utils (2)
- `serialNumberGenerator.js`
- `auditLogger.js`

## 🗂️ New Database Tables

| Table | Purpose |
|-------|---------|
| `equipment_sets` | Equipment groups |
| `equipment_usage_logs` | Usage tracking |
| `equipment_audit_trail` | Action logs |
| `equipment_inventory_checks` | Weekly checks |
| `equipment_inventory_check_items` | Check details |
| `equipment_technician_reports` | Weekly reports |

## 🆕 New Equipment Columns

| Column | Type | Example |
|--------|------|---------|
| `serialNumber` | VARCHAR(100) | PC-CALAPAN-2026-00001 |
| `setId` | VARCHAR(50) | PC-SET-CALAPAN-001 |
| `manufacturer` | VARCHAR(100) | Dell, HP, Acer |
| `model` | VARCHAR(100) | OptiPlex 7090 |
| `purchaseDate` | DATE | 2024-05-15 |
| `warrantyExpiry` | DATE | 2027-05-15 |
| `condition` | ENUM | excellent/good/fair/poor/broken |
| `location` | VARCHAR(255) | Lab 1, Row 3, Station 5 |
| `remarks` | TEXT | Additional notes |

## 🔌 API Endpoints (Base: `/api/equipment-enhancements`)

### Equipment Sets
- `GET /sets` - List all
- `POST /sets` - Create
- `GET /sets/:id` - Get details
- `POST /sets/:setId/equipment` - Add equipment

### Inventory Checks
- `POST /inventory-checks` - Create check
- `POST /inventory-checks/:checkId/items` - Add item
- `POST /inventory-checks/:id/complete` - Complete
- `GET /inventory-checks/stats/summary` - Stats

### Usage Tracking
- `POST /usage/start` - Start session
- `POST /usage/:id/end` - End session
- `GET /usage/active` - Active sessions
- `GET /usage/stats` - Statistics

### Audit Trail
- `GET /audit/recent` - Recent activity
- `GET /audit/equipment/:id` - Equipment history
- `GET /audit/search?query=` - Search

### Technician Reports
- `POST /reports` - Create report
- `POST /reports/:id/submit` - Submit
- `GET /reports` - List all

## 🔧 Integration Code Snippets

### Register Routes (index.js)
```javascript
const enhancementRoutes = require('./routes/equipmentEnhancementsRoutes');
app.use('/api/equipment-enhancements', enhancementRoutes);
```

### Add Audit Logging (equipmentController.js)
```javascript
const { enhancedCreateEquipment } = require('./equipmentControllerEnhanced');

// After creating equipment:
try {
  await enhancedCreateEquipment(equipment, req);
} catch (e) { console.log('Enhancement skipped'); }
```

### Generate Serial Number
```javascript
const { generateSerialNumber } = require('./utils/serialNumberGenerator');
const serialNumber = await generateSerialNumber('PC', 'CALAPAN');
// Returns: PC-CALAPAN-2026-00001
```

## 📊 Usage Examples

### Create Equipment Set
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/sets \
  -H "Content-Type: application/json" \
  -d '{"setName":"Lab 1 Station 1","campusId":1,"type":"PC"}'
```

### Start Usage Session
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/usage/start \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":1,"userId":123,"campusId":1}'
```

### View Recent Activity
```bash
curl http://localhost:3001/api/equipment-enhancements/audit/recent?limit=10
```

### Create Inventory Check
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/inventory-checks \
  -H "Content-Type: application/json" \
  -d '{"campusId":1,"notes":"Weekly check"}'
```

## 🛠️ Useful Commands

### Check Migration Status
```sql
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES LIKE 'equipment_%';"
```

### View Serial Numbers
```sql
mysql -u comlab -pcomlab123 comlab -e "SELECT equipmentId, serialNumber FROM equipment LIMIT 10;"
```

### Check Audit Trail
```sql
mysql -u comlab -pcomlab123 comlab -e "SELECT COUNT(*) FROM equipment_audit_trail;"
```

### Monitor Logs
```bash
pm2 logs xianfires --lines 50
```

### Test API Health
```bash
curl http://localhost:3001/api/equipment-enhancements/health
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Routes 404 | Check routes registered in index.js |
| Serial numbers not generating | Check utils/serialNumberGenerator.js exists |
| Audit trail empty | Check PM2 logs for errors (fails silently) |
| Migration fails | Check MySQL credentials in .env |
| App won't start | `pm2 logs xianfires` for errors |

## 📱 Quick Rollback

```bash
# Stop app
pm2 stop xianfires

# Restore database
mysql -u comlab -pcomlab123 comlab < backups/backup_YYYYMMDD.sql

# Start app
pm2 start xianfires
```

## 📚 Documentation Map

| Need | Read |
|------|------|
| Understand features | `FEATURE_SUMMARY.md` |
| Install/deploy | `INSTALLATION_GUIDE.md` |
| Integrate code | `INTEGRATION_GUIDE.md` |
| API details | `API_REFERENCE.md` |
| Database migration | `MIGRATION_GUIDE.md` |
| Full technical plan | `IMPLEMENTATION_PLAN.md` |
| Deployment checklist | `DEPLOYMENT_CHECKLIST.md` |
| Overview | `README_ENHANCEMENTS.md` |

## ✅ Post-Deploy Verification

```bash
# 1. Health check
curl http://localhost:3001/api/equipment-enhancements/health

# 2. Check tables exist
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES;" | grep equipment_

# 3. Check app running
pm2 status

# 4. Check logs clear
pm2 logs xianfires --lines 20

# 5. Test existing features
curl http://localhost:3001/api/equipment
```

## 🎯 Serial Number Formats

| Type | Format | Example |
|------|--------|---------|
| Equipment | CATEGORY-CAMPUS-YEAR-XXXXX | PC-CALAPAN-2026-00001 |
| Set | TYPE-SET-CAMPUS-XXX | PC-SET-CALAPAN-001 |
| Inventory | INV-YEAR-WXX | INV-2026-W40 |
| Report | TECH-YEAR-WXX | TECH-2026-W40 |

## 🔐 Permissions Guide

| Feature | Student | Faculty | Technician | Admin |
|---------|---------|---------|------------|-------|
| View equipment | ✅ | ✅ | ✅ | ✅ |
| Use equipment | ✅ | ✅ | ❌ | ❌ |
| Create equipment | ❌ | ❌ | ✅ | ✅ |
| Equipment sets | ❌ | ❌ | ✅ | ✅ |
| Inventory checks | ❌ | ❌ | ✅ | ✅ |
| View audit trail | ❌ | ❌ | ✅ | ✅ |
| Technician reports | ❌ | ❌ | ✅ (own) | ✅ (all) |
| Review reports | ❌ | ❌ | ❌ | ✅ |

## 💾 Backup Locations

```
/home/ubuntu/ComLab/backups/
├── pre_enhancement_YYYYMMDD_HHMMSS.sql (migration script)
├── comlab_backup_YYYY-MM-DD.sql (migration runner)
└── manual_backup_YYYYMMDD_HHMMSS.sql (your backups)
```

## 🎓 Training Priorities

1. **Admin** - Equipment creation with new fields, audit trail viewing
2. **Technician** - Inventory checks, weekly reports, equipment sets
3. **Students** - Equipment selection during check-in (if UI updated)

## 📞 Emergency Contacts

**System Issues:**
- Check: `pm2 logs xianfires`
- Location: `/home/ubuntu/ComLab`
- User: `ubuntu`

**Database Issues:**
- Check: `sudo tail -f /var/log/mysql/error.log`
- Credentials: comlab / comlab123
- Database: comlab

**Rollback:**
- Restore: `mysql -u comlab -pcomlab123 comlab < backup.sql`
- Remove routes from index.js
- Restart: `pm2 restart xianfires`

---

**Print this page and keep it handy during deployment!**

**Version:** 1.0.0 | **URL:** https://comlabfacilitiesms.cyou | **Date:** 2026-09-30
