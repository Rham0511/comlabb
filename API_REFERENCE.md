# Equipment Enhancements - API Reference

## 📌 Base URL
```
http://localhost:3001/api/equipment-enhancements
```

Production:
```
https://comlabfacilitiesms.cyou/api/equipment-enhancements
```

## 🔐 Authentication
Most endpoints require authentication. Include your session cookie or authorization header.

---

## 🎯 Quick Reference

### Equipment Sets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sets` | List all sets |
| GET | `/sets/:id` | Get set with equipment |
| POST | `/sets` | Create new set |
| PUT | `/sets/:id` | Update set |
| DELETE | `/sets/:id` | Delete set (must be empty) |
| POST | `/sets/:setId/equipment` | Add equipment to set |
| DELETE | `/sets/:setId/equipment` | Remove equipment from set |

### Inventory Checks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory-checks` | List all checks |
| GET | `/inventory-checks/:id` | Get check details |
| POST | `/inventory-checks` | Create new check |
| POST | `/inventory-checks/:checkId/items` | Add item to check |
| POST | `/inventory-checks/:id/complete` | Mark check complete |
| POST | `/inventory-checks/:id/review` | Review check (admin) |
| GET | `/inventory-checks/stats/summary` | Get statistics |

### Usage Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/usage/start` | Start usage session |
| POST | `/usage/:id/end` | End usage session |
| GET | `/usage/equipment/:equipmentId` | Equipment usage history |
| GET | `/usage/user/:userId` | User usage history |
| GET | `/usage/stats` | Usage statistics |
| GET | `/usage/active` | Currently active sessions |
| POST | `/usage/link-attendance` | Link usage to attendance |

### Audit Trail
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | List all audit entries |
| GET | `/audit/equipment/:equipmentId` | Equipment audit history |
| GET | `/audit/user/:userId` | User audit history |
| GET | `/audit/stats` | Audit statistics |
| GET | `/audit/recent` | Recent activity |
| GET | `/audit/search` | Search audit trail |
| GET | `/audit/export/csv` | Export to CSV (admin) |

### Technician Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports` | List all reports |
| GET | `/reports/:id` | Get report details |
| POST | `/reports` | Create new report |
| PUT | `/reports/:id` | Update report |
| POST | `/reports/:id/submit` | Submit for review |
| POST | `/reports/:id/review` | Review report (admin) |
| DELETE | `/reports/:id` | Delete report (draft only) |
| GET | `/reports/stats/summary` | Report statistics |

---

## 📖 Detailed Documentation

## Equipment Sets API

### GET /sets
Get all equipment sets with filtering.

**Query Parameters:**
- `campusId` (optional): Filter by campus
- `laboratoryId` (optional): Filter by laboratory
- `status` (optional): Filter by status (active, maintenance, incomplete, retired)

**Response:**
```json
{
  "success": true,
  "sets": [
    {
      "id": 1,
      "setId": "PC-SET-CALAPAN-001",
      "setName": "Computer Lab 1 - Station 1",
      "description": "Complete PC workstation",
      "campusId": 1,
      "laboratoryId": 1,
      "location": "Lab 1, Row 1, Station 1",
      "status": "active",
      "equipmentCount": 4,
      "createdAt": "2026-09-30T10:00:00.000Z"
    }
  ]
}
```

### POST /sets
Create a new equipment set.

**Request Body:**
```json
{
  "setName": "Computer Lab 1 - Station 1",
  "description": "Complete PC workstation with monitor, keyboard, mouse",
  "campusId": 1,
  "laboratoryId": 1,
  "location": "Lab 1, Row 1, Station 1",
  "type": "PC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Equipment set created successfully",
  "set": {
    "id": 1,
    "setId": "PC-SET-CALAPAN-001",
    "setName": "Computer Lab 1 - Station 1",
    ...
  }
}
```

### POST /sets/:setId/equipment
Add equipment to a set.

**Request Body:**
```json
{
  "equipmentIds": [1, 2, 3, 4]
}
```

**Response:**
```json
{
  "success": true,
  "message": "4 equipment item(s) added to set",
  "updatedCount": 4
}
```

---

## Inventory Checks API

### POST /inventory-checks
Create a new weekly inventory check.

**Request Body:**
```json
{
  "checkDate": "2026-09-30",
  "campusId": 1,
  "laboratoryId": 1,
  "notes": "Weekly inventory check for Lab 1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory check created successfully",
  "check": {
    "id": 1,
    "checkId": "INV-2026-W40",
    "checkDate": "2026-09-30",
    "campusId": 1,
    "performedBy": 5,
    "performedByName": "John Technician",
    "status": "in_progress",
    "totalItemsExpected": 50,
    "totalItemsFound": 0,
    "missingCount": 0,
    "damagedCount": 0
  }
}
```

### POST /inventory-checks/:checkId/items
Add an item to an inventory check.

**Request Body:**
```json
{
  "equipmentId": 1,
  "serialNumber": "PC-CALAPAN-2026-00001",
  "expectedLocation": "Lab 1, Row 1, Station 1",
  "actualLocation": "Lab 1, Row 1, Station 1",
  "status": "found",
  "conditionBefore": "good",
  "conditionAfter": "good",
  "notes": "Equipment in good condition"
}
```

**Status Values:** `found`, `missing`, `damaged`, `misplaced`

**Response:**
```json
{
  "success": true,
  "message": "Check item added successfully",
  "item": { ... }
}
```

---

## Usage Tracking API

### POST /usage/start
Start an equipment usage session.

**Request Body:**
```json
{
  "attendanceId": 123,
  "equipmentId": 1,
  "serialNumber": "PC-CALAPAN-2026-00001",
  "userId": 456,
  "campusId": 1,
  "laboratoryId": 1,
  "sessionNotes": "Starting lab work"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usage session started",
  "usageLog": {
    "id": 1,
    "equipmentId": 1,
    "userId": 456,
    "usageStartTime": "2026-09-30T14:30:00.000Z",
    "usageEndTime": null
  }
}
```

### POST /usage/:id/end
End an equipment usage session.

**Request Body:**
```json
{
  "sessionNotes": "Completed lab assignment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usage session ended",
  "usageLog": { ... },
  "durationMinutes": 45
}
```

### GET /usage/stats
Get usage statistics.

**Query Parameters:**
- `campusId` (optional)
- `laboratoryId` (optional)
- `startDate` (optional): YYYY-MM-DD
- `endDate` (optional): YYYY-MM-DD

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalSessions": 150,
    "completedSessions": 145,
    "activeSessions": 5,
    "totalMinutes": 6750,
    "totalHours": "112.50",
    "averageDurationMinutes": "46.55",
    "mostUsedEquipment": [
      { "identifier": "PC-CALAPAN-2026-00001", "usageCount": 25 }
    ]
  }
}
```

---

## Audit Trail API

### GET /audit
Get audit trail with filtering.

**Query Parameters:**
- `equipmentId` (optional)
- `serialNumber` (optional)
- `actionType` (optional)
- `performedBy` (optional)
- `campusId` (optional)
- `startDate` (optional)
- `endDate` (optional)
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

**Action Types:**
- `created`
- `updated`
- `deleted`
- `borrowed`
- `returned`
- `maintenance_started`
- `maintenance_completed`
- `status_changed`
- `condition_changed`
- `location_changed`
- `assigned_to_set`
- `removed_from_set`

**Response:**
```json
{
  "success": true,
  "auditTrail": [
    {
      "id": 1,
      "equipmentId": 1,
      "serialNumber": "PC-CALAPAN-2026-00001",
      "actionType": "created",
      "actionDescription": "Equipment created: PC Monitor (PC-CALAPAN-2026-00001)",
      "performedBy": 5,
      "performedByName": "Admin User",
      "userRole": "admin",
      "campusId": 1,
      "ipAddress": "192.168.1.100",
      "actionTimestamp": "2026-09-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "pages": 3
  }
}
```

### GET /audit/recent
Get recent audit activity.

**Query Parameters:**
- `campusId` (optional)
- `limit` (optional, default: 20)

### GET /audit/search
Search audit trail.

**Query Parameters:**
- `query` (required, min 3 characters)
- `limit` (optional, default: 50)

Searches in: serialNumber, actionDescription, performedByName

---

## Technician Reports API

### POST /reports
Create a new technician report.

**Request Body:**
```json
{
  "reportDate": "2026-09-30",
  "campusId": 1,
  "laboratoryId": 1,
  "reportType": "weekly",
  "summary": "All equipment in good working condition this week",
  "equipmentIssuesCount": 2,
  "maintenancePerformed": 1,
  "newEquipmentAdded": 0,
  "equipmentRetired": 0,
  "inventoryCheckCompleted": true,
  "inventoryCheckId": 5,
  "recommendations": "Replace keyboard in Station 5, upgrade RAM in Station 10"
}
```

**Report Types:** `weekly`, `incident`, `maintenance`, `audit`

**Response:**
```json
{
  "success": true,
  "message": "Technician report created successfully",
  "report": {
    "id": 1,
    "reportId": "TECH-2026-W40",
    "reportDate": "2026-09-30",
    "weekNumber": 40,
    "technicianId": 5,
    "technicianName": "John Technician",
    "status": "draft",
    ...
  }
}
```

### POST /reports/:id/submit
Submit a report for review.

**Response:**
```json
{
  "success": true,
  "message": "Report submitted successfully",
  "report": {
    "id": 1,
    "status": "submitted",
    "submittedAt": "2026-09-30T16:00:00.000Z"
  }
}
```

### POST /reports/:id/review
Review and approve/reject a report (admin only).

**Request Body:**
```json
{
  "reviewComments": "Report looks good, approved.",
  "approved": true
}
```

---

## 🔍 Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details (in development)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## 📊 Example Use Cases

### Use Case 1: Weekly Inventory Check

```javascript
// 1. Create inventory check
const checkResponse = await fetch('/api/equipment-enhancements/inventory-checks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campusId: 1,
    laboratoryId: 1,
    notes: 'Weekly check for Lab 1'
  })
});
const { check } = await checkResponse.json();

// 2. Check each equipment
for (const equipment of equipmentList) {
  await fetch(`/api/equipment-enhancements/inventory-checks/${check.checkId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      equipmentId: equipment.id,
      serialNumber: equipment.serialNumber,
      status: 'found', // or 'missing', 'damaged', 'misplaced'
      conditionBefore: equipment.condition,
      conditionAfter: equipment.condition
    })
  });
}

// 3. Complete the check
await fetch(`/api/equipment-enhancements/inventory-checks/${check.id}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notes: 'Inventory check completed'
  })
});
```

### Use Case 2: Track Student Equipment Usage

```javascript
// When student checks in
const usageResponse = await fetch('/api/equipment-enhancements/usage/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    equipmentId: selectedEquipmentId,
    userId: studentId,
    campusId: 1,
    laboratoryId: 1,
    attendanceId: attendanceRecordId
  })
});

// When student checks out
await fetch(`/api/equipment-enhancements/usage/${usageLog.id}/end`, {
  method: 'POST'
});
```

### Use Case 3: View Equipment History

```javascript
// Get complete history of a specific equipment
const history = await fetch(`/api/equipment-enhancements/audit/equipment/PC-CALAPAN-2026-00001`)
  .then(r => r.json());

console.log('Equipment history:', history.auditTrail);
```

---

## 🧪 Testing with cURL

```bash
# Health check
curl http://localhost:3001/api/equipment-enhancements/health

# Get all sets
curl http://localhost:3001/api/equipment-enhancements/sets

# Get recent audit activity
curl http://localhost:3001/api/equipment-enhancements/audit/recent?limit=10

# Get active usage sessions
curl http://localhost:3001/api/equipment-enhancements/usage/active

# Get usage statistics
curl "http://localhost:3001/api/equipment-enhancements/usage/stats?campusId=1"
```

---

**API Version**: 1.0.0  
**Last Updated**: 2026-09-30  
**Base Path**: `/api/equipment-enhancements`
