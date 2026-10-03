# PC Seat Selector - Student-to-PC Traceability

## Overview
The PC Seat Selector is a visual interface that allows students to select their workstation after registering attendance. This feature provides real-time visibility of PC availability and tracks which student is using which equipment.

## Features

### 1. Visual Grid Layout
- **Calendar-like Interface**: PCs are displayed in a grid layout similar to a cinema seat selector
- **Color-coded Status**:
  - 🟢 **Green**: Available PCs that students can select
  - ⚪ **Gray**: Occupied PCs currently in use by other students
  - 🔵 **Blue**: Currently selected PC (before confirmation)
- **Sequential Numbering**: Each PC is numbered sequentially (PC 1, PC 2, PC 3, etc.)

### 2. Real-time Availability
- Shows current availability status based on active usage sessions
- Automatically fetches PC status when modal opens
- Filters PCs by campus and laboratory (if applicable)

### 3. Session Tracking
- Creates equipment usage log entry when PC is assigned
- Tracks:
  - Which student is using which PC
  - Start time of usage
  - Associated attendance record
  - Equipment serial number
- Automatically ends previous session if student selects a new PC

## User Interface

### Modal Components

1. **Header**
   - Title: "Select Your PC Station"
   - Close button (X)

2. **Info Banner**
   - Instructions for using the selector
   - Icon-based visual guidance

3. **Legend**
   - Available (Green box)
   - Occupied (Gray box)
   - Selected (Blue box)

4. **PC Grid**
   - Responsive grid layout
   - Desktop: Auto-fills with ~80px minimum per cell
   - Mobile: Adapts to smaller screens
   - Each cell shows:
     - Computer icon
     - PC number
     - Status label (Free/In Use)

5. **Action Buttons**
   - Cancel: Closes modal without saving
   - Confirm Selection: Assigns selected PC to student

## Technical Implementation

### Frontend (attendance.html)

#### CSS Classes
```css
.pc-selector-backdrop     - Modal overlay
.pc-selector-modal        - Modal container
.pc-selector-header       - Modal header
.pc-selector-body         - Modal body
.pc-grid-container        - PC grid layout
.pc-seat                  - Individual PC cell
.pc-seat.available        - Available PC styling
.pc-seat.occupied         - Occupied PC styling
.pc-seat.selected         - Selected PC styling
```

#### JavaScript Functions
```javascript
openPCSelector(attendanceId, laboratoryId)  - Opens modal
closePCSelector()                            - Closes modal
fetchPCStations()                            - Fetches available PCs
renderPCGrid()                               - Renders PC grid
selectPC(pcId, isOccupied)                  - Handles PC selection
confirmPCSelection()                         - Confirms and saves selection
```

### Backend (Node.js/Express)

#### API Endpoints

**1. Get PC Availability**
```
GET /api/equipment/pc-availability
Query Parameters:
  - campus: string (optional) - Campus name
  - laboratory: string (optional) - Laboratory name

Response:
{
  "success": true,
  "stations": [
    {
      "id": 123,
      "equipmentId": "CPU001",
      "name": "Computer Lab PC",
      "assetNumber": "CPU-001",
      "campus": "Bongabong Campus",
      "laboratoryRoom": "Lab 1",
      "stationNumber": 1,
      "isOccupied": false,
      "occupiedByUserId": null,
      "occupiedByName": null
    }
  ],
  "total": 25,
  "available": 15,
  "occupied": 10
}
```

**2. Assign PC to Student**
```
POST /api/equipment/assign-pc
Body:
{
  "attendanceId": 456,           // optional
  "equipmentId": 123,            // required
  "userId": 789,                 // required
  "campus": "Bongabong Campus",  // optional
  "laboratory": "Lab 1"          // optional
}

Response:
{
  "success": true,
  "message": "PC assigned successfully",
  "usageLogId": 1001,
  "equipmentId": 123,
  "userId": 789,
  "campus": "Bongabong Campus",
  "laboratory": "Lab 1"
}
```

**3. End PC Session**
```
POST /api/equipment/end-pc-session
Body:
{
  "userId": 789,                 // required
  "equipmentId": 123            // optional
}

Response:
{
  "success": true,
  "message": "PC session ended successfully",
  "sessionsEnded": 1
}
```

**4. Get Current PC Assignment**
```
GET /api/equipment/current-assignment/:userId

Response:
{
  "success": true,
  "hasAssignment": true,
  "assignment": {
    "usageLogId": 1001,
    "equipmentId": 123,
    "usageStartTime": "2026-09-30T10:00:00Z",
    "equipmentName": "Computer Lab PC",
    "assetNumber": "CPU-001",
    "laboratoryRoom": "Lab 1",
    "durationMinutes": 45
  }
}
```

### Database Schema

**equipment_usage_logs table**
```sql
CREATE TABLE equipment_usage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attendanceId INT,
  equipmentId INT,
  serialNumber VARCHAR(100),
  userId INT NOT NULL,
  campusId INT,
  laboratoryId INT,
  usageStartTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usageEndTime TIMESTAMP NULL,
  durationMinutes INT NULL,
  sessionNotes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_equipment (equipmentId),
  INDEX idx_user (userId),
  INDEX idx_active_sessions (usageEndTime)
);
```

## Usage Workflow

### For Students

1. **Register Attendance**
   - Student scans QR code or registers through attendance system
   - Attendance record is created

2. **PC Selector Opens**
   - Modal automatically appears after attendance registration
   - Alternative: Click "Test PC Selector" button (for testing)

3. **Select PC**
   - View available PCs (green)
   - Click on desired PC
   - Selected PC turns blue

4. **Confirm Selection**
   - Click "Confirm Selection" button
   - Success message appears
   - Modal closes automatically

5. **Session Tracking**
   - Equipment usage log entry created
   - Session tracked until student logs out or session ends

### For Administrators

**Viewing PC Usage:**
- Check equipment_usage_logs table in database
- Filter by date, user, or equipment
- View duration and session details

**Ending Sessions:**
- Sessions can be manually ended via API
- Automatic end when student selects new PC
- Can be integrated with logout process

## Integration Points

### 1. Attendance System
Trigger PC selector after attendance registration:
```javascript
// After attendance registration succeeds
window.dispatchEvent(new CustomEvent('attendanceRegistered', {
  detail: {
    attendanceId: 123,
    laboratoryId: 1
  }
}));
```

### 2. QR Scanner
Add PC selector to QR scan success:
```javascript
// After successful QR scan
if (scanResult.success) {
  openPCSelector(scanResult.attendanceId, scanResult.laboratoryId);
}
```

### 3. Logout Process
End PC session on logout:
```javascript
// On logout
await fetch('/api/equipment/end-pc-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: currentUser.id })
});
```

## Testing

### Test Button
A test button is included at the bottom-right of the attendance page:
- Opens PC selector without requiring attendance registration
- Useful for testing and demonstration
- Can be removed in production by deleting the button HTML

### Manual Testing Steps
1. Navigate to `/attendance` page
2. Click "Test PC Selector" button
3. Verify PC grid loads correctly
4. Click on available PC (green)
5. Click "Confirm Selection"
6. Check database for new entry in equipment_usage_logs

### Database Verification
```sql
-- Check recent PC assignments
SELECT 
  eul.*,
  u.name as student_name,
  e.name as equipment_name
FROM equipment_usage_logs eul
JOIN users u ON eul.userId = u.id
JOIN equipment e ON eul.equipmentId = e.id
ORDER BY eul.usageStartTime DESC
LIMIT 10;

-- Check active sessions
SELECT 
  eul.*,
  u.name as student_name,
  e.name as equipment_name,
  TIMESTAMPDIFF(MINUTE, eul.usageStartTime, NOW()) as duration_minutes
FROM equipment_usage_logs eul
JOIN users u ON eul.userId = u.id
JOIN equipment e ON eul.equipmentId = e.id
WHERE eul.usageEndTime IS NULL;
```

## Customization

### Styling
Modify CSS variables in attendance.html:
```css
.pc-seat.available {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.08);
}
```

### Grid Layout
Adjust grid columns in CSS:
```css
.pc-grid-container {
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
}
```

### PC Filtering
Modify fetchPCStations() to add custom filters:
```javascript
// Filter by laboratory
if (laboratory) {
  queryParams += `&laboratory=${encodeURIComponent(laboratory)}`;
}
```

## Future Enhancements

1. **Real-time Updates**
   - WebSocket integration for live PC availability
   - Auto-refresh when PCs become available

2. **PC Status Indicators**
   - Show student names on occupied PCs (admin only)
   - Display duration of current usage

3. **Seat Reservation**
   - Allow students to reserve PCs in advance
   - Queue system for full laboratories

4. **Analytics Dashboard**
   - PC utilization reports
   - Peak usage times
   - Student usage patterns

5. **Mobile App Integration**
   - QR scan triggers PC selector
   - Push notifications for PC availability

## Troubleshooting

### PC Selector Not Opening
- Check browser console for errors
- Verify `openPCSelector()` is being called
- Check if modal backdrop has class="open"

### No PCs Showing
- Verify equipment table has category='CPU'
- Check equipment status is 'Serviceable'
- Verify campus/laboratory filtering

### Assignment Fails
- Check userId is valid
- Verify equipmentId exists
- Check equipment_usage_logs table permissions
- Review server logs for SQL errors

### Session Not Ending
- Verify userId in request
- Check UPDATE query in endPCSession()
- Ensure usageEndTime column is nullable

## Files Modified

1. `/home/ubuntu/ComLab/attendance.html` - Frontend UI and logic
2. `/home/ubuntu/ComLab/controllers/pcAssignmentController.js` - Backend controller
3. `/home/ubuntu/ComLab/routes/index.js` - Route registration

## Dependencies

- **Frontend**: Tailwind CSS, Font Awesome
- **Backend**: Express.js, Sequelize, MySQL
- **Database**: equipment_usage_logs table (created via migration)
