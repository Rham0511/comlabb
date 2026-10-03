# Equipment Enhancements - Integration Guide

## 📋 Overview
This guide shows you how to integrate the new equipment management features into your existing ComLab codebase **without breaking anything**.

## 🎯 Integration Philosophy

**Key Principles:**
1. ✅ **Additive, not destructive** - New features don't change existing code
2. ✅ **Backwards compatible** - Everything that works now will keep working
3. ✅ **Optional features** - Use what you need, ignore what you don't
4. ✅ **Gradual adoption** - Integrate features one at a time

## 🔧 Step-by-Step Integration

### Step 1: Register New API Routes

In your main server file (`index.js` or `app.js`), add the new routes:

```javascript
// Add this import near your other route imports
const equipmentEnhancementsRoutes = require('./routes/equipmentEnhancementsRoutes');

// Register the routes (add this with your other route registrations)
app.use('/api/equipment-enhancements', equipmentEnhancementsRoutes);
```

**Test it works:**
```bash
curl http://localhost:3001/api/equipment-enhancements/health
```

### Step 2: Enhance Equipment Creation (Optional)

Update your `equipmentController.js` to add audit logging and serial numbers.

**Option A: Minimal Integration (Recommended for first deployment)**

Add this **after** you create equipment in your `createEquipment` function:

```javascript
// At the top of your equipmentController.js
const { enhancedCreateEquipment } = require('./equipmentControllerEnhanced');

// In your createEquipment function, after equipment.create():
const equipment = await Equipment.create({
  equipmentId,
  assetNumber,
  name,
  category: name,
  campus,
  laboratoryRoom,
  status: nextStatus,
  dateAdded,
  qrCode,
  qrImage,
  qrGeneratedAt
});

// ADD THIS: Enhance with serial number and audit logging
try {
  await enhancedCreateEquipment(equipment, req, {
    manufacturer: req.body.manufacturer,
    model: req.body.model,
    condition: req.body.condition || 'good',
    location: req.body.location || laboratoryRoom,
    remarks: req.body.remarks
  });
} catch (enhancementError) {
  // Don't fail the request if enhancement fails
  console.log('Enhancement skipped:', enhancementError.message);
}

// Continue with your existing code
await logAuditEntry(req, { ... });
res.status(201).json(equipment);
```

**Option B: Accept New Fields from Frontend**

If you want to accept the new fields from your frontend forms:

```javascript
export const createEquipment = async (req, res) => {
  const { 
    assetNumber = "", 
    name, 
    campus: requestedCampus, 
    laboratoryRoom, 
    status,
    // NEW FIELDS (optional)
    manufacturer,
    model,
    purchaseDate,
    warrantyExpiry,
    condition,
    location,
    remarks,
    serialNumber  // Allow manual serial number entry
  } = req.body;
  
  // ... your existing validation code ...
  
  const equipment = await Equipment.create({
    equipmentId,
    assetNumber,
    name,
    category: name,
    campus,
    laboratoryRoom,
    status: nextStatus,
    dateAdded,
    qrCode,
    qrImage,
    qrGeneratedAt,
    // NEW FIELDS
    serialNumber,      // If not provided, will be auto-generated
    manufacturer,
    model,
    purchaseDate,
    warrantyExpiry,
    condition: condition || 'good',
    location: location || laboratoryRoom,
    remarks
  });
  
  // Enhance with auto serial number if not provided
  try {
    await enhancedCreateEquipment(equipment, req);
  } catch (e) {
    console.log('Enhancement skipped:', e.message);
  }
  
  // ... rest of your existing code ...
};
```

### Step 3: Enhance Equipment Updates (Optional)

Add audit logging to your `updateEquipment` function:

```javascript
// At the top of your equipmentController.js
const { enhancedUpdateEquipment } = require('./equipmentControllerEnhanced');

// In your updateEquipment function:
export const updateEquipment = async (req, res) => {
  // ... your existing code ...
  
  const equipment = await findEquipmentByIdentifier(id, req);
  if (!equipment) {
    return res.status(404).json({ error: "Equipment not found." });
  }
  
  // ADD THIS: Save state before update for audit trail
  const equipmentBefore = equipment.toJSON();
  
  // Your existing update code
  await equipment.update({
    assetNumber,
    name,
    category: name,
    campus,
    laboratoryRoom,
    status,
    // NEW FIELDS (add these if you want to allow updates)
    manufacturer: req.body.manufacturer,
    model: req.body.model,
    condition: req.body.condition,
    location: req.body.location,
    remarks: req.body.remarks
  });
  
  // ADD THIS: Log the update to audit trail
  try {
    await enhancedUpdateEquipment(equipmentBefore, equipment, req);
  } catch (e) {
    console.log('Audit logging skipped:', e.message);
  }
  
  // ... rest of your existing code ...
};
```

### Step 4: Enhance Equipment Deletion (Optional)

Add audit logging to your `deleteEquipment` function:

```javascript
// At the top of your equipmentController.js
const { enhancedDeleteEquipment } = require('./equipmentControllerEnhanced');

// In your deleteEquipment function:
export const deleteEquipment = async (req, res) => {
  // ... your existing code ...
  
  const equipment = await findEquipmentByIdentifier(id, req);
  if (!equipment) {
    return res.status(404).json({ error: "Equipment not found." });
  }
  
  // ADD THIS: Log deletion before it happens
  try {
    await enhancedDeleteEquipment(equipment, req);
  } catch (e) {
    console.log('Audit logging skipped:', e.message);
  }
  
  // Your existing delete code
  await equipment.destroy();
  
  // ... rest of your existing code ...
};
```

### Step 5: Link Attendance to Equipment Usage (Optional)

If you want to track which equipment students use during attendance:

In your `attendanceController.js`, when creating attendance:

```javascript
const EquipmentUsageLog = require('../models/equipmentUsageLogModel');

// After creating attendance record:
const attendance = await Attendance.create({ ... });

// If student selected equipment, log usage
if (req.body.equipmentId || req.body.serialNumber) {
  try {
    await EquipmentUsageLog.create({
      attendanceId: attendance.id,
      equipmentId: req.body.equipmentId,
      serialNumber: req.body.serialNumber,
      userId: attendance.userId,
      campusId: attendance.campusId,
      laboratoryId: attendance.laboratoryId,
      usageStartTime: new Date()
    });
  } catch (e) {
    console.log('Usage logging skipped:', e.message);
  }
}
```

When student checks out (time_out):

```javascript
// When updating attendance with time_out:
if (attendance.equipmentId || req.body.equipmentId) {
  try {
    const usageLog = await EquipmentUsageLog.findOne({
      where: {
        attendanceId: attendance.id,
        usageEndTime: null
      }
    });
    
    if (usageLog) {
      const endTime = new Date();
      const startTime = new Date(usageLog.usageStartTime);
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      await usageLog.update({
        usageEndTime: endTime,
        durationMinutes
      });
    }
  } catch (e) {
    console.log('Usage end logging skipped:', e.message);
  }
}
```

## 🎨 Frontend Integration

### Adding Serial Number to Equipment Forms

Update your equipment creation form (`admin-dashboard.html` or equipment modal):

```html
<!-- Add these fields to your equipment form -->

<!-- Serial Number (auto-generated if empty) -->
<div class="form-group">
  <label for="serialNumber">Serial Number (Optional - Auto-generated)</label>
  <input type="text" id="serialNumber" name="serialNumber" 
         placeholder="Leave empty for auto-generation" class="form-control">
  <small class="form-text text-muted">
    Will auto-generate like: PC-CALAPAN-2026-00001
  </small>
</div>

<!-- Manufacturer -->
<div class="form-group">
  <label for="manufacturer">Manufacturer</label>
  <input type="text" id="manufacturer" name="manufacturer" 
         placeholder="e.g., Dell, HP, Acer" class="form-control">
</div>

<!-- Model -->
<div class="form-group">
  <label for="model">Model</label>
  <input type="text" id="model" name="model" 
         placeholder="e.g., OptiPlex 7090" class="form-control">
</div>

<!-- Condition -->
<div class="form-group">
  <label for="condition">Condition</label>
  <select id="condition" name="condition" class="form-control">
    <option value="excellent">Excellent</option>
    <option value="good" selected>Good</option>
    <option value="fair">Fair</option>
    <option value="poor">Poor</option>
    <option value="broken">Broken</option>
  </select>
</div>

<!-- Purchase Date -->
<div class="form-group">
  <label for="purchaseDate">Purchase Date</label>
  <input type="date" id="purchaseDate" name="purchaseDate" class="form-control">
</div>

<!-- Location -->
<div class="form-group">
  <label for="location">Location</label>
  <input type="text" id="location" name="location" 
         placeholder="e.g., Lab 1, Row 2, Station 5" class="form-control">
</div>

<!-- Remarks -->
<div class="form-group">
  <label for="remarks">Remarks</label>
  <textarea id="remarks" name="remarks" rows="3" 
            class="form-control" placeholder="Additional notes"></textarea>
</div>
```

### Displaying Serial Numbers in Equipment Lists

Update your equipment table to show serial numbers:

```html
<table class="table">
  <thead>
    <tr>
      <th>Equipment ID</th>
      <th>Serial Number</th> <!-- NEW COLUMN -->
      <th>Name</th>
      <th>Condition</th> <!-- NEW COLUMN -->
      <th>Status</th>
      <th>Location</th> <!-- NEW COLUMN -->
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <!-- In your JavaScript that populates the table: -->
    <script>
      equipmentList.forEach(equipment => {
        const row = `
          <tr>
            <td>${equipment.equipmentId}</td>
            <td>${equipment.serialNumber || 'N/A'}</td>
            <td>${equipment.name}</td>
            <td>
              <span class="badge badge-${getConditionColor(equipment.condition)}">
                ${equipment.condition || 'N/A'}
              </span>
            </td>
            <td>${equipment.status}</td>
            <td>${equipment.location || equipment.laboratoryRoom}</td>
            <td>
              <button onclick="viewEquipment('${equipment.id}')">View</button>
              <button onclick="editEquipment('${equipment.id}')">Edit</button>
            </td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
      
      function getConditionColor(condition) {
        const colors = {
          'excellent': 'success',
          'good': 'info',
          'fair': 'warning',
          'poor': 'danger',
          'broken': 'dark'
        };
        return colors[condition] || 'secondary';
      }
    </script>
  </tbody>
</table>
```

### Adding Equipment Set Selection to Attendance

When students check in, let them select equipment:

```html
<!-- In your attendance check-in form -->
<div class="form-group">
  <label for="equipmentSelect">Select Equipment (Optional)</label>
  <select id="equipmentSelect" name="equipmentId" class="form-control">
    <option value="">-- No specific equipment --</option>
    <!-- Populate with available equipment via API -->
  </select>
</div>

<script>
// Load available equipment when form opens
async function loadAvailableEquipment() {
  try {
    const response = await fetch('/api/equipment-enhancements/usage/active');
    const data = await response.json();
    
    // Get all equipment and filter out those in use
    const allEquipment = await fetch('/api/equipment').then(r => r.json());
    const inUseIds = data.activeSessions.map(s => s.equipmentId);
    
    const availableEquipment = allEquipment.filter(e => !inUseIds.includes(e.id));
    
    const select = document.getElementById('equipmentSelect');
    availableEquipment.forEach(equipment => {
      const option = document.createElement('option');
      option.value = equipment.id;
      option.textContent = `${equipment.serialNumber || equipment.equipmentId} - ${equipment.name}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading equipment:', error);
  }
}
</script>
```

## 📊 Using the New Features

### View Audit Trail

```javascript
// Get recent activity
fetch('/api/equipment-enhancements/audit/recent?limit=20')
  .then(r => r.json())
  .then(data => {
    console.log('Recent activity:', data.recentActivity);
  });

// Get equipment history
fetch('/api/equipment-enhancements/audit/equipment/PC-CALAPAN-2026-00001')
  .then(r => r.json())
  .then(data => {
    console.log('Equipment history:', data.auditTrail);
  });
```

### Track Equipment Usage

```javascript
// Start usage when student checks in
fetch('/api/equipment-enhancements/usage/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    equipmentId: 123,
    userId: studentId,
    campusId: 1,
    laboratoryId: 1
  })
})
.then(r => r.json())
.then(data => {
  console.log('Usage session started:', data.usageLog);
});

// End usage when student checks out
fetch(`/api/equipment-enhancements/usage/${usageLogId}/end`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionNotes: 'Completed lab work'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Usage duration:', data.durationMinutes, 'minutes');
});
```

### Create Equipment Sets

```javascript
// Create a new set
fetch('/api/equipment-enhancements/sets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setName: 'Computer Lab 1 - Station 1',
    description: 'Complete PC workstation',
    campusId: 1,
    laboratoryId: 1,
    location: 'Lab 1, Row 1, Station 1',
    type: 'PC'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Set created:', data.set);
  
  // Add equipment to the set
  return fetch(`/api/equipment-enhancements/sets/${data.set.setId}/equipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      equipmentIds: [1, 2, 3, 4] // Monitor, CPU, Keyboard, Mouse
    })
  });
});
```

## ✅ Testing Your Integration

### Test Checklist

- [ ] New routes are accessible (health check returns 200)
- [ ] Can create equipment (with or without new fields)
- [ ] Serial numbers are auto-generated when not provided
- [ ] Equipment creation is logged in audit trail
- [ ] Can update equipment without errors
- [ ] Equipment updates are logged in audit trail
- [ ] Can delete equipment without errors
- [ ] Equipment deletion is logged in audit trail
- [ ] Existing equipment list page still works
- [ ] Existing equipment forms still work
- [ ] QR code generation still works
- [ ] Attendance system still works

### Test Commands

```bash
# 1. Health check
curl http://localhost:3001/api/equipment-enhancements/health

# 2. Create test equipment via API
curl -X POST http://localhost:3001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name":"Test PC","campus":"CALAPAN","status":"Serviceable"}'

# 3. Check if serial number was generated
curl http://localhost:3001/api/equipment | grep -i "serialNumber"

# 4. View audit trail
curl http://localhost:3001/api/equipment-enhancements/audit/recent

# 5. Check PM2 logs for errors
pm2 logs xianfires --lines 50
```

## 🐛 Troubleshooting Integration

### Issue: Routes return 404
**Solution:** Make sure you registered the routes in your main server file and restarted PM2.

### Issue: Serial numbers not generating
**Solution:** Check that the `utils/serialNumberGenerator.js` file exists and is being imported correctly.

### Issue: Audit logs not appearing
**Solution:** The audit logger fails silently to not break main functionality. Check PM2 logs for errors.

### Issue: Existing forms broken
**Solution:** New fields are optional. Make sure your forms still submit the required fields (name, campus).

### Issue: Database errors on equipment creation
**Solution:** Make sure you ran the migration. Check: `mysql -u comlab -pcomlab123 comlab -e "DESCRIBE equipment;"`

## 📝 Rollback Plan

If you need to rollback the integration:

1. **Remove route registration** from your main server file
2. **Remove enhanced function calls** from your controllers
3. **Restart application**: `pm2 restart xianfires`

The database tables will remain (harmless), but the features won't be used.

## 🎓 Next Steps

1. Test basic integration (serial numbers + audit logging)
2. Update frontend forms to show new fields
3. Train technicians on new features
4. Enable inventory check workflow
5. Enable technician reporting
6. Review audit trail reports

---

**Integration Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete  
**Date**: _______________  
**Integrated By**: _______________
