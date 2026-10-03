# Equipment Enhancements - Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Phase 1: Preparation (Before Deployment)

- [ ] **Read all documentation**
  - [ ] FEATURE_SUMMARY.md (understand what you're deploying)
  - [ ] IMPLEMENTATION_PLAN.md (technical details)
  - [ ] MIGRATION_GUIDE.md (database changes)
  - [ ] INTEGRATION_GUIDE.md (code changes)

- [ ] **Backup current system**
  - [ ] Database backup created
  - [ ] Application files backed up
  - [ ] Backup location documented: _______________
  - [ ] Backup tested (can restore)

- [ ] **Verify prerequisites**
  - [ ] Node.js installed (check: `node --version`)
  - [ ] MySQL running (check: `mysql -u comlab -pcomlab123 -e "SELECT 1;"`)
  - [ ] PM2 installed (check: `pm2 --version`)
  - [ ] Disk space available (check: `df -h`)
  - [ ] Application currently working

- [ ] **Development/Staging test**
  - [ ] Created test database
  - [ ] Ran migration on test database
  - [ ] Tested new features in staging
  - [ ] Verified backwards compatibility

---

## 🚀 Phase 2: Database Migration

### Step 1: Create Backup
```bash
cd /home/ubuntu/ComLab
mkdir -p backups
mysqldump -u comlab -pcomlab123 comlab > backups/pre_enhancement_$(date +%Y%m%d_%H%M%S).sql
```

- [ ] Backup file created: `backups/pre_enhancement_YYYYMMDD_HHMMSS.sql`
- [ ] Backup file size verified (should be several MB)
- [ ] Backup location recorded

### Step 2: Run Migration
```bash
cd /home/ubuntu/ComLab
bash quick-migrate.sh
```

OR manually:
```bash
node run-migration.js
```

- [ ] Migration script executed without errors
- [ ] Saw success message: "✅ Migration completed successfully!"
- [ ] 6 new tables created
- [ ] Equipment table enhanced with 9 columns

### Step 3: Verify Migration
```sql
-- Check tables exist
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES LIKE 'equipment_%';"

-- Check equipment columns
mysql -u comlab -pcomlab123 comlab -e "DESCRIBE equipment;"
```

- [ ] All 6 new tables exist
- [ ] Equipment table has new columns: serialNumber, setId, manufacturer, model, etc.
- [ ] Existing equipment data unchanged
- [ ] Equipment count matches pre-migration: `SELECT COUNT(*) FROM equipment;`

---

## 🔧 Phase 3: Application Integration

### Step 1: Register Routes

Edit your main server file (likely `index.js`):

```javascript
// Add near other route imports
const equipmentEnhancementsRoutes = require('./routes/equipmentEnhancementsRoutes');

// Add with other route registrations
app.use('/api/equipment-enhancements', equipmentEnhancementsRoutes);
```

- [ ] Route import added
- [ ] Route registered with app
- [ ] File saved

### Step 2: Enhance Equipment Controller (Optional but Recommended)

Add to `controllers/equipmentController.js`:

```javascript
// At top of file
const { enhancedCreateEquipment, enhancedUpdateEquipment, enhancedDeleteEquipment } = require('./equipmentControllerEnhanced');

// In createEquipment function, after creating equipment:
try {
  await enhancedCreateEquipment(equipment, req);
} catch (e) { console.log('Enhancement skipped:', e.message); }

// In updateEquipment function:
const equipmentBefore = equipment.toJSON();
// ... your update code ...
try {
  await enhancedUpdateEquipment(equipmentBefore, equipment, req);
} catch (e) { console.log('Audit skipped:', e.message); }

// In deleteEquipment function, before deletion:
try {
  await enhancedDeleteEquipment(equipment, req);
} catch (e) { console.log('Audit skipped:', e.message); }
```

- [ ] Enhanced functions imported
- [ ] Enhanced functions called in create/update/delete
- [ ] Try-catch blocks added (fail gracefully)

### Step 3: Restart Application
```bash
pm2 restart xianfires
pm2 status
pm2 logs xianfires --lines 50
```

- [ ] PM2 restart successful
- [ ] Application status: "online"
- [ ] No errors in logs
- [ ] Application accessible at https://comlabfacilitiesms.cyou

---

## ✅ Phase 4: Verification & Testing

### Test 1: Health Check
```bash
curl http://localhost:3001/api/equipment-enhancements/health
```

Expected: `{"success":true,"message":"Equipment Enhancements API is running"}`

- [ ] Health check returns 200 OK
- [ ] Response includes feature list

### Test 2: Existing Functionality
- [ ] Can access equipment inventory page
- [ ] Can view existing equipment
- [ ] Can add new equipment (old form still works)
- [ ] Can edit equipment
- [ ] Can delete equipment
- [ ] QR codes still generate
- [ ] Attendance system works
- [ ] Borrow/return works

### Test 3: New Features

**Serial Number Auto-Generation:**
```bash
# Create equipment and check if serial number generated
curl -X POST http://localhost:3001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Monitor","campus":"CALAPAN","status":"Serviceable"}'
  
# Check equipment has serialNumber
curl http://localhost:3001/api/equipment | grep serialNumber
```

- [ ] New equipment gets auto-generated serial number
- [ ] Serial number format: `CATEGORY-CAMPUS-YEAR-XXXXX`

**Audit Trail:**
```bash
curl http://localhost:3001/api/equipment-enhancements/audit/recent?limit=5
```

- [ ] Audit trail returns recent actions
- [ ] Equipment creation logged
- [ ] Equipment updates logged

**Equipment Sets:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/sets \
  -H "Content-Type: application/json" \
  -d '{"setName":"Test Set","campusId":1,"type":"PC"}'
```

- [ ] Can create equipment sets
- [ ] Sets get unique setId like `PC-SET-CALAPAN-001`

**Usage Tracking:**
```bash
curl http://localhost:3001/api/equipment-enhancements/usage/active
```

- [ ] Can query active sessions
- [ ] Returns empty array initially (no active sessions)

**Inventory Checks:**
```bash
curl -X POST http://localhost:3001/api/equipment-enhancements/inventory-checks \
  -H "Content-Type: application/json" \
  -d '{"campusId":1,"notes":"Test check"}'
```

- [ ] Can create inventory check
- [ ] Check ID format: `INV-YYYY-WXX`

**Technician Reports:**
```bash
curl http://localhost:3001/api/equipment-enhancements/reports
```

- [ ] Can query reports
- [ ] Returns empty array initially

---

## 📊 Phase 5: User Acceptance Testing

### Admin Testing
- [ ] Login as admin
- [ ] Create new equipment with new fields (manufacturer, model, condition)
- [ ] View equipment details showing serial number
- [ ] View audit trail for equipment
- [ ] Create equipment set
- [ ] Add equipment to set

### Technician Testing
- [ ] Login as technician
- [ ] Create weekly inventory check
- [ ] Add items to inventory check
- [ ] Complete inventory check
- [ ] Create weekly report
- [ ] Submit report for review

### Student/Faculty Testing
- [ ] Login as student
- [ ] Check in to lab
- [ ] Select equipment (if UI updated)
- [ ] Check out from lab
- [ ] View usage history (if UI added)

---

## 🎨 Phase 6: Frontend Updates (Optional)

### Equipment Forms
- [ ] Add serial number field (optional, auto-generated)
- [ ] Add manufacturer field
- [ ] Add model field
- [ ] Add condition dropdown
- [ ] Add purchase date field
- [ ] Add location field
- [ ] Add remarks textarea

### Equipment Lists
- [ ] Display serial numbers in table
- [ ] Display condition badges
- [ ] Display location
- [ ] Add "View History" button → shows audit trail

### Attendance System
- [ ] Add equipment selector when checking in
- [ ] Show which equipment student is using
- [ ] Auto-end usage when checking out

### Reports Section
- [ ] Add "Audit Trail" page
- [ ] Add "Usage Reports" page
- [ ] Add "Inventory Checks" page
- [ ] Add "Technician Reports" page

---

## 📝 Phase 7: Training & Documentation

### Staff Training
- [ ] Train admins on new features
- [ ] Train technicians on inventory workflow
- [ ] Train technicians on report submission
- [ ] Create user manual/guide
- [ ] Record training videos (optional)

### Documentation
- [ ] Update system documentation
- [ ] Update user guides
- [ ] Document new workflows
- [ ] Create troubleshooting guide

---

## 🔍 Phase 8: Monitoring & Optimization

### Week 1 After Deployment
- [ ] Monitor PM2 logs daily
- [ ] Check for errors in audit trail
- [ ] Verify serial numbers generating correctly
- [ ] Check database growth
- [ ] Gather user feedback

### Week 2-4 After Deployment
- [ ] Review audit trail reports
- [ ] Analyze usage statistics
- [ ] Optimize slow queries (if any)
- [ ] Address user-reported issues
- [ ] Fine-tune workflows

---

## 🐛 Troubleshooting

### Issue Checklist

**Application won't start:**
- [ ] Check PM2 logs: `pm2 logs xianfires --lines 100`
- [ ] Check for syntax errors in code
- [ ] Verify all files exist
- [ ] Check database connection

**Routes return 404:**
- [ ] Verify routes registered in main file
- [ ] Check route path matches API calls
- [ ] Restart application: `pm2 restart xianfires`

**Serial numbers not generating:**
- [ ] Check `utils/serialNumberGenerator.js` exists
- [ ] Check for database errors in logs
- [ ] Verify equipment table has serialNumber column

**Audit trail empty:**
- [ ] Audit logger fails silently (by design)
- [ ] Check for errors in PM2 logs
- [ ] Verify audit_trail table exists
- [ ] Check if enhanced functions are being called

---

## 🔄 Rollback Procedure

If something goes wrong and you need to rollback:

### Emergency Rollback
```bash
# 1. Stop application
pm2 stop xianfires

# 2. Restore database
mysql -u comlab -pcomlab123 comlab < backups/pre_enhancement_YYYYMMDD_HHMMSS.sql

# 3. Remove route registration from code (if added)
# Edit index.js and comment out the enhancement routes

# 4. Restart application
pm2 start xianfires

# 5. Verify application works
curl http://localhost:3001/api/equipment
```

### Partial Rollback (Keep Database, Disable Features)
```bash
# 1. Comment out route registration in index.js
# 2. Remove enhanced function calls from equipmentController.js
# 3. Restart: pm2 restart xianfires
```

---

## ✅ Final Checklist

### Deployment Complete When:
- [ ] All tests passing
- [ ] No errors in PM2 logs (30 minutes after deployment)
- [ ] Existing features work normally
- [ ] New API endpoints accessible
- [ ] Serial numbers auto-generating
- [ ] Audit trail logging actions
- [ ] Staff trained on new features
- [ ] Documentation updated
- [ ] Backup verified and stored safely

### Sign-Off

**Deployed By:** _______________________  
**Date:** _______________________  
**Time:** _______________________  
**Version:** 1.0.0  

**Tested By:** _______________________  
**Approved By:** _______________________  

**Production URL:** https://comlabfacilitiesms.cyou  
**Health Check:** https://comlabfacilitiesms.cyou/api/equipment-enhancements/health

---

## 📞 Support Contacts

**Technical Issues:**
- Check PM2 logs first: `pm2 logs xianfires`
- Review documentation in `/home/ubuntu/ComLab/*.md`
- Check MySQL logs: `sudo tail -f /var/log/mysql/error.log`

**Database Issues:**
- Verify connection: `mysql -u comlab -pcomlab123 comlab -e "SELECT 1;"`
- Check table existence: `SHOW TABLES;`
- Restore from backup if needed

**Application Issues:**
- Restart: `pm2 restart xianfires`
- Check status: `pm2 status`
- View logs: `pm2 logs xianfires --lines 200`

---

## 📈 Success Metrics

Track these metrics after deployment:

**Week 1:**
- Equipment with serial numbers: _______
- Audit trail entries: _______
- Usage sessions tracked: _______
- Errors encountered: _______

**Month 1:**
- Inventory checks completed: _______
- Technician reports submitted: _______
- Equipment sets created: _______
- User satisfaction: _______ / 10

---

**Status:** ⏳ Not Started / 🔄 In Progress / ✅ Deployed / ❌ Rolled Back
