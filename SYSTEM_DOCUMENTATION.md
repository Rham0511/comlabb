# ComLab - Computer Laboratory Facilities Management System
## Complete System Documentation

**System URL:** https://comlabfacilitiesms.cyou  
**Institution:** Mindoro State University - College of Computer Studies  
**Date:** September 20, 2026  
**Version:** 1.0.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [System Architecture](#system-architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [User Workflows](#user-workflows)
5. [Features by Role](#features-by-role)
6. [Database Schema](#database-schema)
7. [Technical Specifications](#technical-specifications)
8. [Deployment Information](#deployment-information)
9. [Security & Compliance](#security--compliance)
10. [Maintenance & Support](#maintenance--support)

---

## 1. System Overview

### 1.1 Purpose
The Computer Laboratory Facilities Management System (ComLab) is a comprehensive web-based platform designed to streamline and automate the management of computer laboratory facilities, equipment, attendance tracking, and resource scheduling for Mindoro State University.

### 1.2 Key Objectives
- **Automate Attendance Tracking:** QR code-based system for quick and accurate time-in/time-out
- **Equipment Management:** Digital tracking of equipment inventory, borrowing, and maintenance
- **Schedule Management:** Centralized laboratory schedule creation and monitoring
- **Multi-Campus Support:** Separate data management for different campus locations
- **Real-time Reporting:** Generate attendance, equipment, and utilization reports
- **Paperless Operations:** Eliminate manual forms and paper-based processes

### 1.3 Target Users
- **Students:** 500+ active users across multiple campuses
- **Faculty/Instructors (Admin):** 30+ teaching staff
- **Technicians:** 10+ technical support staff
- **System Administrators:** 2-3 IT staff members

---

## 2. System Architecture

### 2.1 Technology Stack

#### **Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Tailwind CSS for styling
- XianFire Framework templating engine
- Responsive design (mobile-first approach)

#### **Backend:**
- Node.js (Runtime environment)
- Express.js (Web framework)
- Sequelize ORM (Database abstraction)
- bcrypt.js (Password hashing)
- Nodemailer (Email service)

#### **Database:**
- MySQL 8.4.3
- InnoDB storage engine
- Full ACID compliance

#### **Infrastructure:**
- AWS EC2 (t3.micro instance)
- Nginx (Reverse proxy & web server)
- PM2 (Process manager)
- Cloudflare (CDN, SSL, DDoS protection)
- Let's Encrypt (SSL certificates)

### 2.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT DEVICES                            │
│  (Desktop, Laptop, Tablet, Mobile Phone)                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE CDN                             │
│  • SSL/TLS Termination                                       │
│  • DDoS Protection                                           │
│  • Caching & Optimization                                    │
│  • DNS Management                                            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  AWS EC2 INSTANCE                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              NGINX (Reverse Proxy)                    │   │
│  │  • Port 80/443                                        │   │
│  │  • Load balancing                                     │   │
│  │  • Static file serving                                │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │         NODE.JS APPLICATION (PM2)                     │   │
│  │  • Express.js server                                  │   │
│  │  • Port 3000                                          │   │
│  │  • Business logic                                     │   │
│  │  • Session management                                 │   │
│  │  • Authentication & Authorization                     │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │            MYSQL DATABASE                             │   │
│  │  • Port 3306                                          │   │
│  │  • User data                                          │   │
│  │  • Attendance records                                 │   │
│  │  • Equipment inventory                                │   │
│  │  • Schedules & logs                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                               │
│  • Gmail SMTP (Email notifications)                          │
│  • Cloudflare DNS                                            │
│  • AWS Route 53 (Backup DNS)                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow Architecture

```
USER REQUEST → Cloudflare → Nginx → Node.js App → MySQL Database
                                        ↓
                                  Email Service
                                        ↓
                                   Gmail SMTP
```

---

## 3. User Roles & Permissions

### 3.1 Role Overview

| Role | Description | Count | Primary Functions |
|------|-------------|-------|-------------------|
| **Student** | Enrolled students using lab facilities | 500+ | Attendance, Equipment Borrowing |
| **Admin** | Faculty and instructors | 30+ | Schedule Management, Reports |
| **Technician** | Technical support staff | 10+ | Equipment Management, Maintenance |

### 3.2 Permission Matrix

| Feature | Student | Admin | Technician |
|---------|---------|-------|------------|
| **Authentication** |
| Register Account | ✅ | ❌ | ❌ |
| Login/Logout | ✅ | ✅ | ✅ |
| Reset Password | ✅ | ✅ | ✅ |
| Email Verification | ✅ | ✅ | ✅ |
| **Profile Management** |
| View Own Profile | ✅ | ✅ | ✅ |
| Update Own Profile | ✅ | ✅ | ✅ |
| Upload Profile Photo | ✅ | ✅ | ✅ |
| View All Users | ❌ | ✅ | ✅ |
| **Laboratory Schedules** |
| View Schedules | ✅ | ✅ | ✅ |
| Create Schedules | ❌ | ✅ | ❌ |
| Edit Schedules | ❌ | ✅ | ❌ |
| Delete Schedules | ❌ | ✅ | ❌ |
| Generate QR Code | ❌ | ✅ | ❌ |
| **Attendance** |
| Scan QR (Time-in/out) | ✅ | ❌ | ❌ |
| View Own Attendance | ✅ | ❌ | ❌ |
| View All Attendance | ❌ | ✅ | ✅ |
| Mark Attendance Status | ❌ | ✅ | ❌ |
| Export Attendance | ❌ | ✅ | ✅ |
| **Equipment Management** |
| View Equipment List | ✅ | ✅ | ✅ |
| Add Equipment | ❌ | ✅ | ✅ |
| Edit Equipment | ❌ | ✅ | ✅ |
| Delete Equipment | ❌ | ✅ | ✅ |
| **Equipment Borrowing** |
| Submit Borrow Request | ✅ | ❌ | ❌ |
| View Own Requests | ✅ | ❌ | ❌ |
| View All Requests | ❌ | ✅ | ✅ |
| Approve/Reject Requests | ❌ | ❌ | ✅ |
| Record Equipment Return | ❌ | ❌ | ✅ |
| **Maintenance** |
| View Maintenance Requests | ❌ | ✅ | ✅ |
| Create Maintenance Request | ❌ | ✅ | ✅ |
| Update Request Status | ❌ | ✅ | ✅ |
| Close Maintenance Request | ❌ | ✅ | ✅ |
| **Reports & Analytics** |
| View Reports Dashboard | ❌ | ✅ | ✅ |
| Generate Attendance Reports | ❌ | ✅ | ✅ |
| Generate Equipment Reports | ❌ | ✅ | ✅ |
| Generate Utilization Reports | ❌ | ✅ | ✅ |
| Export Reports (CSV/PDF) | ❌ | ✅ | ✅ |
| **Campus Management** |
| View Own Campus Data | ✅ | ✅ | ✅ |
| View All Campus Data | ❌ | ✅ | ❌ |
| Switch Campus View | ❌ | ✅ | ❌ |

---

## 4. User Workflows

### 4.1 Student Registration & Onboarding

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Initial Registration                            │
└─────────────────────────────────────────────────────────┘
    Student visits: https://comlabfacilitiesms.cyou
    ↓
    Clicks "Sign Up" / "Register"
    ↓
    Fills registration form:
    • Full Name
    • Email Address
    • Student Number (e.g., 2023-0051)
    • Program (e.g., BSIT)
    • Year Level (1st - 4th Year)
    • Section (e.g., F1)
    • Campus (Bongabong/Calapan/Victoria)
    • Password (minimum 8 characters)
    • Confirm Password
    ↓
    Submits form
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Email Verification                              │
└─────────────────────────────────────────────────────────┘
    System generates 6-digit OTP code
    ↓
    System sends email to student:
    • Subject: "Verify your email for ComLab"
    • Contains 6-digit verification code
    • Code expires in 10 minutes
    ↓
    Student opens email
    ↓
    Student enters 6-digit code in verification page
    ↓
    System validates code
    ↓
    If valid: Account activated ✅
    If invalid/expired: Show error, option to resend
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: First Login                                     │
└─────────────────────────────────────────────────────────┘
    Student goes to login page
    ↓
    Enters email & password
    ↓
    System authenticates credentials
    ↓
    Redirects to Student Dashboard
    ↓
    Student sees:
    • Welcome message
    • Available laboratory schedules
    • Quick access to features
    • Profile completion prompt (if needed)
```

### 4.2 Student Attendance Workflow (QR Code)

```
┌─────────────────────────────────────────────────────────┐
│ SETUP: Admin Creates Schedule with QR Code              │
└─────────────────────────────────────────────────────────┘
    Admin logs in
    ↓
    Creates laboratory schedule:
    • Subject: "CAPSTONE 2"
    • Instructor: "Ma'am Glenda P. Binay"
    • Lab: "Room 205"
    • Campus: "Bongabong"
    • Day: "Monday"
    • Time: "1:00 PM - 2:00 PM"
    ↓
    System generates unique QR code for this schedule
    ↓
    Admin displays QR code in laboratory
    (Print poster or show on TV/projector)
    ↓
┌─────────────────────────────────────────────────────────┐
│ TIME-IN: Student Arrives at Laboratory                  │
└─────────────────────────────────────────────────────────┘
    Student arrives at lab (e.g., 1:05 PM)
    ↓
    Opens ComLab website on phone/laptop
    ↓
    Logs in (if not already logged in)
    ↓
    Goes to "Attendance" or "Scan QR"
    ↓
    Scans QR code displayed in lab
    (Uses phone camera or QR scanner)
    ↓
    System validates:
    • QR code is valid
    • Schedule is active today
    • Current time is within schedule time
    • Student hasn't already timed-in
    ↓
    System records attendance:
    • Student ID
    • Laboratory Schedule
    • Time-in: 1:05 PM
    • Status: "Present" (if on time) or "Late" (if >15 min)
    ↓
    Student sees confirmation:
    "✅ Time-in recorded: 1:05 PM"
    ↓
┌─────────────────────────────────────────────────────────┐
│ TIME-OUT: Student Leaves Laboratory                     │
└─────────────────────────────────────────────────────────┘
    Student finishes lab work (e.g., 2:00 PM)
    ↓
    Scans same QR code again
    ↓
    System detects existing time-in record
    ↓
    System records time-out:
    • Time-out: 2:00 PM
    • Duration: 55 minutes
    ↓
    Student sees confirmation:
    "✅ Time-out recorded: 2:00 PM. Thank you!"
    ↓
    Attendance record is complete
```

### 4.3 Equipment Borrowing Workflow

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Student Submits Borrow Request                  │
└─────────────────────────────────────────────────────────┘
    Student logs in
    ↓
    Goes to "Borrow Equipment"
    ↓
    Browses available equipment:
    • Mice
    • Keyboards
    • Headsets
    • HDMI Cables
    • USB Flash Drives
    • etc.
    ↓
    Selects equipment to borrow
    ↓
    Fills borrow form:
    • Equipment: "Wireless Mouse"
    • Quantity: 1
    • Purpose: "For laboratory work"
    • Expected Return Date: "Tomorrow"
    ↓
    Submits request
    ↓
    System creates borrow record:
    • Status: "Pending"
    • Requested by: Student Name
    • Requested at: Current timestamp
    ↓
    Student sees: "Request submitted. Waiting for approval."
    ↓
    System sends notification to technician
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Technician Reviews Request                      │
└─────────────────────────────────────────────────────────┘
    Technician logs in
    ↓
    Sees notification: "1 New Borrow Request"
    ↓
    Goes to "Borrow Requests"
    ↓
    Views request details:
    • Student: "Mark Rhamzel Mogol"
    • Equipment: "Wireless Mouse"
    • Quantity: 1
    • Purpose: "For laboratory work"
    • Date: "Today, 2:30 PM"
    ↓
    Checks equipment availability
    ↓
    Technician decides:
    
    OPTION A: APPROVE
    ↓
    Clicks "Approve"
    ↓
    Updates status: "Approved"
    ↓
    System sends email to student:
    "✅ Your borrow request has been approved.
     Please pick up the equipment from the lab."
    ↓
    Student picks up equipment from technician
    ↓
    Technician hands over equipment
    ↓
    Updates status: "Borrowed"
    
    OPTION B: REJECT
    ↓
    Clicks "Reject"
    ↓
    Provides reason: "Equipment not available"
    ↓
    System sends email to student:
    "❌ Your borrow request has been rejected.
     Reason: Equipment not available"
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: Equipment Return                                │
└─────────────────────────────────────────────────────────┘
    Student returns to lab with equipment
    ↓
    Hands equipment to technician
    ↓
    Technician inspects equipment condition:
    • Physical damage check
    • Functionality test
    ↓
    If condition is GOOD:
    ↓
    Technician marks as "Returned"
    ↓
    Updates equipment status: "Available"
    ↓
    Borrow record closed
    ↓
    System sends confirmation email to student:
    "✅ Equipment returned successfully. Thank you!"
    
    If equipment is DAMAGED:
    ↓
    Technician notes damage in system
    ↓
    May create maintenance request
    ↓
    Student may be flagged for follow-up
```

### 4.4 Laboratory Schedule Creation (Admin)

```
┌─────────────────────────────────────────────────────────┐
│ Admin Creates New Laboratory Schedule                   │
└─────────────────────────────────────────────────────────┘
    Admin (Instructor) logs in
    ↓
    Goes to "Laboratory Schedules"
    ↓
    Clicks "Create New Schedule"
    ↓
    Fills schedule form:
    
    BASIC INFORMATION:
    • Subject: "CAPSTONE 2"
    • Instructor: "Ma'am Glenda P. Binay"
    • Laboratory Room: "Room 205"
    • Campus: "Bongabong Campus"
    
    SCHEDULE DETAILS:
    • Day of Week: "Monday"
    • Start Time: "1:00 PM"
    • End Time: "2:30 PM"
    
    SETTINGS:
    • Status: "Confirmed"
    • QR Code Enabled: ✅ Yes
    • Allow Late Entry: ✅ Yes (15 min grace period)
    ↓
    Submits form
    ↓
    System validates:
    • No schedule overlap in same room
    • Valid time range
    • All required fields filled
    ↓
    System creates schedule record
    ↓
    System generates unique QR code:
    • Contains: Schedule ID, Lab, Time, Date
    • Format: Base64 encoded JSON
    ↓
    Admin sees success message:
    "✅ Schedule created successfully!"
    ↓
    Admin can:
    • Download QR code (PNG image)
    • Print QR code poster
    • Display QR code in laboratory
    ↓
┌─────────────────────────────────────────────────────────┐
│ Schedule is Now Active                                  │
└─────────────────────────────────────────────────────────┘
    Students can see schedule in their dashboard
    ↓
    Students can scan QR code for attendance
    ↓
    Admin can view attendance in real-time
    ↓
    System tracks all attendance records
```

### 4.5 Maintenance Request Workflow

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Issue Identification                            │
└─────────────────────────────────────────────────────────┘
    Technician/Admin notices equipment issue:
    • Computer won't boot
    • Mouse not working
    • Monitor display problem
    • Keyboard keys stuck
    • etc.
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Create Maintenance Request                      │
└─────────────────────────────────────────────────────────┘
    Technician logs in
    ↓
    Goes to "Maintenance Requests"
    ↓
    Clicks "Create Request"
    ↓
    Fills maintenance form:
    
    EQUIPMENT DETAILS:
    • Equipment ID: "PC-R205-15"
    • Equipment Name: "Desktop Computer"
    • Location: "Room 205, Station 15"
    • Campus: "Bongabong"
    
    ISSUE DETAILS:
    • Issue Type: "Hardware Failure"
    • Description: "Computer won't boot. Black screen on startup."
    • Severity: "High"
    • Priority: "Urgent"
    
    ASSIGNMENT:
    • Assigned To: "John Doe (Senior Technician)"
    • Expected Resolution: "Within 24 hours"
    ↓
    Submits request
    ↓
    System creates maintenance record:
    • Status: "Pending"
    • Created by: Current user
    • Created at: Current timestamp
    ↓
    System sends notification to assigned technician
    ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: Technician Works on Issue                       │
└─────────────────────────────────────────────────────────┘
    Assigned technician receives notification
    ↓
    Reviews maintenance request details
    ↓
    Updates status: "In Progress"
    ↓
    Adds progress notes:
    • "Checked power supply - OK"
    • "Tested RAM modules - Found faulty RAM"
    • "Replaced RAM module"
    • "System booting normally now"
    ↓
    Tests equipment functionality
    ↓
    If FIXED:
    ↓
    Updates status: "Completed"
    ↓
    Adds resolution notes:
    • Action Taken: "Replaced faulty RAM module"
    • Parts Used: "8GB DDR4 RAM"
    • Time Spent: "1 hour"
    ↓
    Updates equipment status: "Available"
    ↓
    System notifies requester: "Maintenance completed"
    
    If NOT FIXED / NEEDS ESCALATION:
    ↓
    Updates status: "Escalated"
    ↓
    Adds escalation notes
    ↓
    May order replacement parts
    ↓
    Updates equipment status: "Under Repair"
```

---

## 5. Features by Role

### 5.1 Student Features

#### **5.1.1 Dashboard**
- **Overview Cards:**
  - Total attendance count (present/late)
  - Pending borrow requests
  - Active schedules today
  - Equipment borrowed (current)
  
- **Quick Actions:**
  - Scan QR Code
  - Borrow Equipment
  - View Schedule
  - View Attendance History

#### **5.1.2 Attendance Management**
- **View Own Attendance:**
  - Filter by date range
  - Filter by subject
  - See time-in/time-out records
  - See attendance status (Present/Late/Absent)
  - Calculate attendance percentage
  
- **QR Code Scanning:**
  - Camera-based QR scanner
  - Manual code entry option
  - Instant time-in/out recording
  - Visual confirmation feedback

#### **5.1.3 Laboratory Schedules**
- **View Schedules:**
  - Current week schedule
  - Filter by day
  - Filter by laboratory
  - See instructor details
  - See time slots
  
- **Schedule Details:**
  - Subject name
  - Instructor name
  - Laboratory room
  - Day and time
  - QR code (for attendance)

#### **5.1.4 Equipment Borrowing**
- **Browse Equipment:**
  - View available equipment
  - Filter by type
  - Filter by location
  - See equipment details
  - Check availability status
  
- **Submit Borrow Request:**
  - Select equipment
  - Specify quantity
  - Enter purpose/reason
  - Set expected return date
  - Track request status
  
- **My Requests:**
  - View pending requests
  - View approved requests
  - View rejected requests (with reason)
  - View borrowed equipment
  - View return history

#### **5.1.5 Profile Management**
- **View Profile:**
  - Student number
  - Full name
  - Email
  - Program, Year, Section
  - Campus
  - Profile photo
  
- **Update Profile:**
  - Change name
  - Upload profile photo
  - Update contact info
  - Change password

### 5.2 Admin Features

#### **5.2.1 Dashboard**
- **Statistics Overview:**
  - Total students enrolled
  - Today's attendance count
  - Active laboratory schedules
  - Equipment utilization rate
  - Pending maintenance requests
  
- **Charts & Graphs:**
  - Weekly attendance trends
  - Laboratory usage by day
  - Equipment borrow frequency
  - Campus-wise statistics

#### **5.2.2 Laboratory Schedule Management**
- **Create Schedule:**
  - Set subject and instructor
  - Choose laboratory room
  - Select campus
  - Set day and time
  - Enable QR code generation
  - Set attendance rules
  
- **Edit Schedule:**
  - Update schedule details
  - Change time slots
  - Reassign instructor
  - Change laboratory
  - Regenerate QR code
  
- **Delete Schedule:**
  - Remove old schedules
  - Archive completed schedules
  - Maintain schedule history
  
- **View All Schedules:**
  - Calendar view
  - List view
  - Filter by campus
  - Filter by instructor
  - Filter by laboratory
  - Export schedule (PDF/CSV)

#### **5.2.3 Attendance Management**
- **View All Attendance:**
  - Real-time attendance tracking
  - Filter by date/date range
  - Filter by laboratory
  - Filter by subject
  - Filter by student
  - Filter by status (Present/Late/Absent)
  
- **Attendance Reports:**
  - Generate attendance summary
  - Export to CSV/Excel
  - Export to PDF
  - Email reports
  - Schedule automatic reports
  
- **Manual Attendance:**
  - Mark student as Present/Late/Absent
  - Add notes/remarks
  - Override attendance records
  - Bulk attendance entry

#### **5.2.4 Student Management**
- **View All Students:**
  - Paginated list view
  - Search by name/student number
  - Filter by program
  - Filter by year level
  - Filter by section
  - Filter by campus
  
- **Student Details:**
  - View complete profile
  - View attendance history
  - View borrow history
  - View schedule enrollment
  - Export student data
  
- **Student Actions:**
  - Approve/reject registrations
  - Reset student password
  - Suspend/activate account
  - Send email notification

#### **5.2.5 Equipment Management**
- **Equipment Inventory:**
  - Add new equipment
  - Edit equipment details
  - Delete equipment
  - View equipment list
  - Search equipment
  - Filter by type/status/location
  
- **Equipment Details:**
  - Equipment ID
  - Name and type
  - Serial number
  - Brand/Model
  - Purchase date
  - Warranty info
  - Current status (Available/In Use/Maintenance)
  - Location (Lab, Campus)
  - Condition notes
  
- **Equipment Tracking:**
  - View borrow history
  - View maintenance history
  - Track equipment location
  - Generate equipment reports

#### **5.2.6 Reports & Analytics**
- **Attendance Reports:**
  - Daily attendance summary
  - Weekly attendance trends
  - Monthly attendance statistics
  - Student attendance percentage
  - Subject-wise attendance
  - Laboratory utilization
  
- **Equipment Reports:**
  - Equipment inventory report
  - Equipment usage statistics
  - Borrow frequency analysis
  - Maintenance cost tracking
  - Equipment depreciation
  
- **Custom Reports:**
  - Date range selection
  - Multi-campus reports
  - Export formats (PDF, CSV, Excel)
  - Schedule automated reports
  - Email delivery

### 5.3 Technician Features

#### **5.3.1 Dashboard**
- **Overview:**
  - Pending borrow requests
  - Active borrowed equipment
  - Pending maintenance requests
  - Equipment status summary
  
- **Quick Actions:**
  - Approve borrow request
  - Record equipment return
  - Create maintenance request
  - Update equipment status

#### **5.3.2 Borrow Request Management**
- **View Requests:**
  - All pending requests
  - Approved requests
  - Rejected requests
  - Active borrows
  - Return history
  
- **Request Actions:**
  - Approve request
  - Reject request (with reason)
  - Record equipment handover
  - Record equipment return
  - Inspect equipment condition
  - Add notes/remarks

#### **5.3.3 Equipment Inventory Management**
- **View Equipment:**
  - Complete equipment list
  - Filter by status
  - Filter by location
  - Search equipment
  
- **Equipment Actions:**
  - Add new equipment
  - Edit equipment details
  - Update equipment status
  - Mark as Available/In Use/Maintenance/Broken
  - Move equipment location
  - Retire equipment

#### **5.3.4 Maintenance Management**
- **View Maintenance Requests:**
  - All requests
  - Filter by status (Pending/In Progress/Completed)
  - Filter by priority
  - Filter by assigned technician
  
- **Create Maintenance Request:**
  - Select equipment
  - Describe issue
  - Set priority level
  - Assign to technician
  - Set expected resolution time
  
- **Update Maintenance:**
  - Change status
  - Add progress notes
  - Upload photos
  - Record parts used
  - Record time spent
  - Mark as completed

#### **5.3.5 Equipment Condition Tracking**
- **Inspection:**
  - Record equipment condition
  - Take photos
  - Note physical damage
  - Test functionality
  - Update status
  
- **Maintenance History:**
  - View past repairs
  - Track recurring issues
  - Analyze failure patterns
  - Schedule preventive maintenance

---

## 6. Database Schema

### 6.1 Core Tables

#### **6.1.1 users**
Stores all user accounts (Students, Admins, Technicians)

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| name | VARCHAR(255) | Full name |
| email | VARCHAR(255) | Email address (unique) |
| password | VARCHAR(255) | Bcrypt hashed password |
| role | VARCHAR(255) | User role: student/admin/technician |
| student_number | VARCHAR(255) | Student ID (nullable for non-students) |
| program | VARCHAR(255) | Academic program (e.g., BSIT) |
| year | VARCHAR(255) | Year level (1st-4th) |
| section | VARCHAR(255) | Class section |
| campus | VARCHAR(255) | Campus location |
| photo | VARCHAR(255) | Profile photo path |
| last_login_at | DATETIME | Last login timestamp |
| email_verified | BOOLEAN | Email verification status |
| verification_token | VARCHAR(255) | Email verification token |
| verification_expires_at | DATETIME | Token expiration |
| otp_code | VARCHAR(6) | One-time password |
| otp_expires_at | DATETIME | OTP expiration |
| otp_purpose | VARCHAR(255) | registration/password_reset |
| createdAt | DATETIME | Record creation date |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX (email)
- INDEX (student_number)
- INDEX (campus)
- INDEX (role)

#### **6.1.2 laboratory_schedules**
Laboratory class schedules

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| subject | VARCHAR(255) | Subject name |
| instructor | VARCHAR(255) | Instructor name |
| laboratoryRoom | VARCHAR(255) | Lab room identifier |
| campus | VARCHAR(255) | Campus location |
| dayOfWeek | VARCHAR(255) | Day (Monday-Sunday) |
| startTime | VARCHAR(255) | Start time (e.g., "1:00 PM") |
| endTime | VARCHAR(255) | End time (e.g., "2:30 PM") |
| status | VARCHAR(255) | Confirmed/Cancelled |
| qrEnabled | BOOLEAN | QR code attendance enabled |
| createdBy | INT | User ID who created schedule |
| createdAt | DATETIME | Record creation date |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- INDEX (campus)
- INDEX (dayOfWeek)
- FOREIGN KEY (createdBy) REFERENCES users(id)

#### **6.1.3 attendance**
Student attendance records

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| studentId | VARCHAR(255) | Student identifier |
| fullName | VARCHAR(255) | Student full name |
| courseSection | VARCHAR(255) | Course and section |
| subject | VARCHAR(255) | Subject name |
| lab | VARCHAR(255) | Laboratory room |
| instructor | VARCHAR(255) | Instructor name |
| date | DATE | Attendance date |
| timeIn | VARCHAR(255) | Time-in timestamp |
| timeOut | VARCHAR(255) | Time-out timestamp (nullable) |
| status | ENUM | Present/Late/Absent |
| sessionToken | VARCHAR(255) | QR session token |
| laboratoryScheduleId | INT | FK to laboratory_schedules |
| createdAt | DATETIME | Record creation date |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- INDEX (studentId)
- INDEX (date)
- INDEX (laboratoryScheduleId)
- FOREIGN KEY (laboratoryScheduleId) REFERENCES laboratory_schedules(id)

#### **6.1.4 equipment**
Equipment inventory

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| equipmentId | VARCHAR(255) | Unique equipment identifier |
| name | VARCHAR(255) | Equipment name |
| type | VARCHAR(255) | Equipment category |
| serialNumber | VARCHAR(255) | Serial number |
| brand | VARCHAR(255) | Brand/Manufacturer |
| model | VARCHAR(255) | Model number |
| status | VARCHAR(255) | Available/In Use/Maintenance/Broken |
| location | VARCHAR(255) | Laboratory location |
| campus | VARCHAR(255) | Campus location |
| condition | TEXT | Condition notes |
| purchaseDate | DATE | Purchase date |
| warrantyExpiry | DATE | Warranty expiry date |
| createdAt | DATETIME | Record creation date |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX (equipmentId)
- INDEX (status)
- INDEX (campus)
- INDEX (location)

#### **6.1.5 borrow_records**
Equipment borrowing records

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| studentId | INT | FK to users table |
| equipmentId | INT | FK to equipment table |
| purpose | TEXT | Borrowing purpose |
| status | VARCHAR(255) | Pending/Approved/Rejected/Borrowed/Returned |
| requestedAt | DATETIME | Request timestamp |
| approvedAt | DATETIME | Approval timestamp |
| borrowedAt | DATETIME | Handover timestamp |
| returnedAt | DATETIME | Return timestamp |
| expectedReturnDate | DATE | Expected return date |
| approvedBy | INT | Technician who approved |
| returnCondition | TEXT | Condition on return |
| remarks | TEXT | Additional notes |
| createdAt | DATETIME | Record creation date |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- INDEX (studentId)
- INDEX (equipmentId)
- INDEX (status)
- FOREIGN KEY (studentId) REFERENCES users(id)
- FOREIGN KEY (equipmentId) REFERENCES equipment(id)
- FOREIGN KEY (approvedBy) REFERENCES users(id)

#### **6.1.6 maintenance_requests**
Equipment maintenance tracking

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| equipmentId | INT | FK to equipment table |
| issueType | VARCHAR(255) | Hardware/Software/Other |
| description | TEXT | Issue description |
| severity | VARCHAR(255) | Low/Medium/High/Critical |
| priority | VARCHAR(255) | Low/Normal/High/Urgent |
| status | VARCHAR(255) | Pending/In Progress/Completed/Escalated |
| createdBy | INT | User who created request |
| assignedTo | INT | Technician assigned |
| resolvedBy | INT | Technician who resolved |
| resolutionNotes | TEXT | Resolution details |
| partsUsed | TEXT | Parts/materials used |
| timeSpent | INT | Minutes spent |
| createdAt | DATETIME | Request creation date |
| startedAt | DATETIME | Work start timestamp |
| completedAt | DATETIME | Completion timestamp |
| updatedAt | DATETIME | Last update date |

**Indexes:**
- PRIMARY KEY (id)
- INDEX (equipmentId)
- INDEX (status)
- INDEX (assignedTo)
- FOREIGN KEY (equipmentId) REFERENCES equipment(id)
- FOREIGN KEY (createdBy) REFERENCES users(id)
- FOREIGN KEY (assignedTo) REFERENCES users(id)
- FOREIGN KEY (resolvedBy) REFERENCES users(id)

### 6.2 Database Relationships

```
users (1) ──────────── (Many) attendance
  │                              │
  │                              │
  ├────────────────────── (Many) borrow_records
  │                              │
  │                              │
  └────────────────────── (Many) maintenance_requests

laboratory_schedules (1) ─── (Many) attendance

equipment (1) ──────────────── (Many) borrow_records
  │
  └──────────────────────────── (Many) maintenance_requests
```

### 6.3 Database Constraints

- **Cascading Deletes:** Disabled to preserve audit trail
- **Foreign Key Constraints:** Enforced for data integrity
- **Unique Constraints:** Email, Equipment ID, Student Number
- **Check Constraints:** Status enums, date validations
- **Default Values:** Timestamps, status fields, boolean flags

---

## 7. Technical Specifications

### 7.1 Server Configuration

#### **AWS EC2 Instance:**
- **Instance Type:** t3.micro
- **vCPUs:** 2
- **Memory:** 1 GB RAM
- **Storage:** 30 GB EBS (gp3)
- **Network:** Enhanced networking enabled
- **Region:** ap-southeast-2 (Sydney)
- **Availability Zone:** ap-southeast-2a
- **Operating System:** Ubuntu 24.04 LTS

#### **Network Configuration:**
- **Public IP:** 3.24.93.0
- **Elastic IP:** Not allocated (using standard public IP)
- **VPC:** Default VPC
- **Subnet:** Public subnet
- **Security Group Rules:**
  - Port 22 (SSH): 0.0.0.0/0
  - Port 80 (HTTP): 0.0.0.0/0
  - Port 443 (HTTPS): 0.0.0.0/0
  - Port 3306 (MySQL): Restricted to localhost only

### 7.2 Software Stack

#### **Web Server:**
- **Nginx:** 1.24.x
- **Configuration:** /etc/nginx/sites-available/comlab
- **Reverse Proxy:** Port 80 → localhost:3000
- **Static Files:** Served directly by Nginx
- **Gzip Compression:** Enabled
- **Client Max Body Size:** 50MB

#### **Application Server:**
- **Node.js:** v20.x LTS
- **Process Manager:** PM2 v5.x
- **Process Name:** xianfires
- **Instances:** 1 (fork mode)
- **Auto Restart:** Enabled
- **Max Memory Restart:** 1000MB
- **Log Location:** ~/.pm2/logs/
- **Startup Script:** Enabled (systemd)

#### **Database Server:**
- **MySQL:** 8.4.3
- **Port:** 3306 (localhost only)
- **Database Name:** comlab
- **Character Set:** utf8mb4
- **Collation:** utf8mb4_0900_ai_ci
- **Storage Engine:** InnoDB
- **Max Connections:** 151
- **Query Cache:** Disabled (deprecated in MySQL 8.x)

#### **SSL/TLS:**
- **Certificate Provider:** Let's Encrypt (via Certbot)
- **Encryption:** TLS 1.2, TLS 1.3
- **Key Exchange:** ECDHE
- **Cipher Suites:** Modern secure ciphers only
- **Certificate Expiry:** December 15, 2026
- **Auto-Renewal:** Enabled (certbot.timer)

#### **CDN & Security:**
- **Provider:** Cloudflare Free Plan
- **SSL Mode:** Full (strict)
- **HTTP → HTTPS:** Always redirect
- **DDoS Protection:** Enabled
- **WAF:** Basic rules enabled
- **Caching:** Enabled with smart routing
- **Proxy Status:** Proxied (orange cloud)

### 7.3 Environment Configuration

**Environment Variables (.env):**
```env
# Application
BASE_URL=https://comlabfacilitiesms.cyou
PORT=3000
SESSION_SECRET=<32-char-secret>

# Database
DB_HOST=localhost
DB_USER=comlab
DB_PASSWORD=comlab123
DB_NAME=comlab
DB_DIALECT=mysql

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=computerlaboratoryfmsminsu@gmail.com
SMTP_PASS=<gmail-app-password>
MAIL_FROM=computerlaboratoryfmsminsu@gmail.com
MAIL_FROM_NAME=COMPUTER LABORATORY FACILITIES MANAGEMENT SYSTEM
```

### 7.4 Performance Specifications

#### **Response Times (Target):**
- **Page Load:** < 2 seconds
- **API Requests:** < 500ms
- **Database Queries:** < 100ms
- **QR Code Scan:** < 1 second

#### **Capacity:**
- **Concurrent Users:** 100+
- **Daily Active Users:** 500+
- **Database Records:** 100,000+ rows
- **File Storage:** Up to 10GB
- **Email Throughput:** 100 emails/hour

#### **Availability:**
- **Uptime Target:** 99.5%
- **Planned Maintenance:** Monthly (30 minutes)
- **Auto-Recovery:** Enabled (PM2 + systemd)

### 7.5 Monitoring & Logging

#### **Application Logs:**
- **Location:** ~/.pm2/logs/xianfires-out.log
- **Rotation:** Daily, keep 3 days
- **Max Size:** 10MB per file
- **Format:** JSON structured logs

#### **System Logs:**
- **Location:** /var/log/
- **Journald:** systemctl logs
- **Retention:** 7 days
- **Cleanup:** Automated via cron

#### **Monitoring:**
- **PM2 Monitoring:** Built-in process monitoring
- **Disk Space:** Automated cleanup script
- **Health Checks:** Cron-based (every 5 minutes)
- **Alerting:** Email notifications on critical issues

---

## 8. Deployment Information

### 8.1 Domain & DNS

#### **Domain Details:**
- **Domain:** comlabfacilitiesms.cyou
- **Registrar:** Nic.com
- **DNS Provider:** Cloudflare
- **Nameservers:**
  - alec.ns.cloudflare.com
  - uma.ns.cloudflare.com

#### **DNS Records:**
```
Type    Name    Content         Proxy Status    TTL
A       @       3.24.93.0       Proxied         Auto
A       www     3.24.93.0       Proxied         Auto
```

### 8.2 SSL Certificate

#### **Certificate Details:**
- **Issuer:** Let's Encrypt (R3)
- **Issued To:** comlabfacilitiesms.cyou, www.comlabfacilitiesms.cyou
- **Valid From:** September 16, 2026
- **Valid Until:** December 15, 2026
- **Key Type:** RSA 2048-bit
- **Auto-Renewal:** Enabled (60 days before expiry)

### 8.3 Deployment Process

#### **Initial Deployment:**
1. Provision AWS EC2 instance
2. Install Ubuntu 24.04 LTS
3. Update system packages
4. Install Node.js, MySQL, Nginx
5. Clone/upload application code
6. Install dependencies (npm install)
7. Configure environment variables
8. Import database schema
9. Configure Nginx reverse proxy
10. Install SSL certificate (Certbot)
11. Configure PM2 process manager
12. Enable PM2 startup script
13. Point domain DNS to server IP
14. Configure Cloudflare proxy
15. Test all functionality
16. Monitor for 24 hours

#### **Update Deployment:**
1. SSH into server
2. Pull latest code changes (or upload)
3. Install new dependencies (if any)
4. Run database migrations (if any)
5. Restart PM2 process: `pm2 restart xianfires`
6. Monitor logs for errors
7. Test critical functionality
8. Rollback if issues detected

### 8.4 Backup Strategy

#### **Database Backups:**
- **Frequency:** Daily at 2:00 AM
- **Retention:** 7 daily, 4 weekly, 3 monthly
- **Method:** mysqldump with compression
- **Storage:** Local + AWS S3 (recommended)
- **Restoration:** Tested monthly

#### **Application Backups:**
- **Code:** Git repository (version controlled)
- **Configuration:** .env file (encrypted backup)
- **Uploads:** Daily sync to backup location
- **Logs:** Archived weekly

#### **Backup Script (Recommended):**
```bash
#!/bin/bash
# /home/ubuntu/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u comlab -pcomlab123 comlab | gzip > $BACKUP_DIR/comlab_$DATE.sql.gz

# Application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /home/ubuntu/ComLab --exclude=node_modules

# Delete backups older than 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Add to crontab: `0 2 * * * /home/ubuntu/backup.sh`

### 8.5 Disaster Recovery

#### **Recovery Time Objective (RTO):** 4 hours
#### **Recovery Point Objective (RPO):** 24 hours

#### **Disaster Recovery Steps:**
1. **Provision new EC2 instance** (or restore snapshot)
2. **Install software stack** (Node.js, MySQL, Nginx)
3. **Restore application code** from Git repository
4. **Restore database** from latest backup
5. **Configure environment** (.env file)
6. **Update DNS records** (if IP changed)
7. **Verify SSL certificate** (reissue if needed)
8. **Test all functionality**
9. **Monitor for 48 hours**

---

## 9. Security & Compliance

### 9.1 Authentication & Authorization

#### **Password Security:**
- **Hashing Algorithm:** bcrypt (8 salt rounds)
- **Minimum Length:** 8 characters
- **Password Reset:** OTP-based (6 digits, 10-minute expiry)
- **Account Lockout:** Not implemented (recommended)
- **Session Management:** Express-session with secure cookies

#### **Email Verification:**
- **Method:** 6-digit OTP code
- **Expiry:** 10 minutes
- **Delivery:** Email via SMTP
- **Resend:** Allowed after 1 minute

#### **Role-Based Access Control (RBAC):**
- **Roles:** Student, Admin, Technician
- **Middleware:** Route-level authorization checks
- **Session Validation:** On every request
- **Privilege Escalation:** Prevented via role checks

### 9.2 Data Protection

#### **Data Encryption:**
- **In Transit:** TLS 1.2/1.3 (HTTPS)
- **At Rest:** MySQL encryption (not enabled by default)
- **Passwords:** bcrypt hashed (never stored plain)
- **Session Data:** Encrypted cookies

#### **Data Privacy:**
- **Personal Information:** Name, email, student number
- **Access Control:** Users can only view own data
- **Data Deletion:** Soft delete (preserve audit trail)
- **Data Export:** CSV/PDF reports (authorized users only)

#### **File Upload Security:**
- **Allowed Types:** Images (PNG, JPG, JPEG, GIF)
- **Max Size:** 50MB
- **Validation:** File type and size checks
- **Storage:** /uploads directory (not web-accessible)
- **Access:** Served via application route with authorization

### 9.3 Security Best Practices

#### **Implemented:**
- ✅ HTTPS everywhere (Cloudflare + Let's Encrypt)
- ✅ Password hashing (bcrypt)
- ✅ SQL injection prevention (Sequelize ORM)
- ✅ XSS protection (input sanitization)
- ✅ CSRF tokens (recommended to implement)
- ✅ Security headers (Nginx configuration)
- ✅ DDoS protection (Cloudflare)
- ✅ Rate limiting (Cloudflare)

#### **Recommended Enhancements:**
- ⚠️ Implement account lockout (brute force protection)
- ⚠️ Add 2FA (two-factor authentication)
- ⚠️ Enable database encryption at rest
- ⚠️ Add CSRF token validation
- ⚠️ Implement API rate limiting
- ⚠️ Add intrusion detection system (IDS)
- ⚠️ Regular security audits
- ⚠️ Penetration testing

### 9.4 Compliance

#### **Data Protection:**
- **Student Data:** Handled according to university policies
- **Email Communications:** Opt-in for non-essential emails
- **Data Retention:** Indefinite (academic records)
- **Data Breach Protocol:** Notify affected users within 72 hours

#### **Audit Trail:**
- **User Actions:** Login, logout, data modifications
- **System Events:** Errors, failures, security events
- **Log Retention:** 90 days minimum
- **Log Access:** Restricted to administrators

---

## 10. Maintenance & Support

### 10.1 Routine Maintenance

#### **Daily:**
- ✅ Monitor system logs for errors
- ✅ Check disk space usage
- ✅ Verify backup completion
- ✅ Monitor application uptime

#### **Weekly:**
- ✅ Review system performance metrics
- ✅ Check for software updates
- ✅ Review user feedback/issues
- ✅ Clean up old logs

#### **Monthly:**
- ✅ Apply security patches
- ✅ Update Node.js dependencies
- ✅ Review and optimize database queries
- ✅ Test disaster recovery procedures
- ✅ Review SSL certificate expiry
- ✅ Analyze system usage trends

### 10.2 Automated Maintenance

#### **Disk Cleanup (Daily at 2:00 AM):**
```bash
# /home/ubuntu/auto-cleanup.sh
sudo apt clean
sudo apt autoremove -y
sudo journalctl --vacuum-time=3d
pm2 flush
find /tmp -type f -mtime +7 -delete
```

#### **Health Check (Every 5 minutes):**
```bash
# /home/ubuntu/check-disk.sh
USAGE=$(df / | grep -vE '^Filesystem' | awk '{print $5}' | sed 's/%//g')
if [ $USAGE -gt 90 ]; then
    /home/ubuntu/auto-cleanup.sh
fi
```

#### **SSL Certificate Renewal (Auto):**
```bash
# Certbot timer (systemd)
# Checks twice daily, renews if <30 days remaining
systemctl status certbot.timer
```

### 10.3 Support Contacts

#### **System Administrator:**
- **Name:** [Your Name]
- **Email:** danicaserdena7@gmail.com
- **Phone:** [Your Phone]
- **Response Time:** Within 24 hours

#### **Technical Support:**
- **Email:** computerlaboratoryfmsminsu@gmail.com
- **Support Hours:** Monday-Friday, 8:00 AM - 5:00 PM
- **Emergency Contact:** [Emergency Phone]

#### **Hosting Provider:**
- **AWS Support:** https://console.aws.amazon.com/support/
- **Cloudflare Support:** https://dash.cloudflare.com/
- **Domain Registrar:** Nic.com support

### 10.4 Troubleshooting Guide

#### **Issue: Website Not Loading**
1. Check server status: `systemctl status nginx`
2. Check PM2 status: `pm2 list`
3. Check DNS resolution: `nslookup comlabfacilitiesms.cyou`
4. Check Cloudflare status
5. Review Nginx logs: `sudo tail -f /var/log/nginx/error.log`

#### **Issue: Database Connection Failed**
1. Check MySQL status: `sudo systemctl status mysql`
2. Test database connection: `mysql -u comlab -p`
3. Check database exists: `SHOW DATABASES;`
4. Verify credentials in .env file
5. Check MySQL error log: `sudo tail -f /var/log/mysql/error.log`

#### **Issue: Email Not Sending**
1. Verify SMTP credentials in .env
2. Test SMTP connection manually
3. Check Gmail account security settings
4. Verify app password is correct
5. Review application logs: `pm2 logs xianfires`

#### **Issue: High Disk Usage**
1. Check disk usage: `df -h`
2. Find large files: `sudo du -sh /* | sort -rh | head -10`
3. Run cleanup script: `./auto-cleanup.sh`
4. Clear PM2 logs: `pm2 flush`
5. Consider increasing EBS volume size

#### **Issue: Application Crashed**
1. Check PM2 status: `pm2 list`
2. Restart application: `pm2 restart xianfires`
3. Review crash logs: `pm2 logs xianfires --err`
4. Check system resources: `htop` or `free -h`
5. Review Node.js errors in logs

### 10.5 Update Procedures

#### **Node.js Package Updates:**
```bash
cd /home/ubuntu/ComLab
npm outdated                    # Check for updates
npm update                      # Update dependencies
pm2 restart xianfires          # Restart application
pm2 logs xianfires --lines 50  # Monitor for errors
```

#### **System Updates:**
```bash
sudo apt update
sudo apt list --upgradable
sudo apt upgrade -y
sudo reboot                    # If kernel updated
```

#### **Database Schema Updates:**
```bash
# Backup first
mysqldump -u comlab -pcomlab123 comlab > backup_$(date +%Y%m%d).sql

# Run migration
node migrate.js

# Verify
mysql -u comlab -pcomlab123 comlab -e "SHOW TABLES;"
```

---

## Appendix A: Server Commands Reference

### Essential Commands

```bash
# Application Management
pm2 list                       # List all processes
pm2 restart xianfires         # Restart application
pm2 stop xianfires            # Stop application
pm2 logs xianfires            # View logs
pm2 monit                     # Monitor resources

# Web Server
sudo systemctl status nginx   # Check Nginx status
sudo systemctl restart nginx  # Restart Nginx
sudo nginx -t                 # Test configuration
sudo systemctl reload nginx   # Reload config

# Database
sudo systemctl status mysql   # Check MySQL status
mysql -u comlab -pcomlab123   # Connect to database
mysqldump -u comlab -p comlab > backup.sql  # Backup

# System
df -h                         # Disk usage
free -h                       # Memory usage
htop                          # System monitor
sudo systemctl reboot         # Reboot server

# SSL Certificate
sudo certbot renew           # Manually renew SSL
sudo certbot certificates    # Check expiry

# Logs
sudo tail -f /var/log/nginx/error.log
pm2 logs xianfires --lines 100
sudo journalctl -u nginx -f
```

---

## Appendix B: Emergency Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| System Admin | [Name] | danicaserdena7@gmail.com | [Phone] |
| Database Admin | [Name] | computerlaboratoryfmsminsu@gmail.com | [Phone] |
| Network Admin | [Name] | [Email] | [Phone] |
| AWS Support | AWS | support@aws.amazon.com | [AWS Support] |
| Cloudflare | Cloudflare | support@cloudflare.com | [CF Support] |

---

## Appendix C: Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-09-20 | 1.0.0 | Initial system deployment | System Team |
| 2026-09-20 | 1.0.0 | SSL certificate installed | System Team |
| 2026-09-20 | 1.0.0 | Disk space increased to 30GB | System Team |
| 2026-09-20 | 1.0.0 | Email notifications configured | System Team |
| 2026-09-20 | 1.0.0 | Auto-restart mechanisms enabled | System Team |

---

## Document Control

**Document Title:** ComLab System Documentation  
**Document Version:** 1.0.0  
**Last Updated:** September 20, 2026  
**Next Review Date:** December 20, 2026  
**Document Owner:** System Administrator  
**Classification:** Internal Use Only

---

**END OF DOCUMENT**

---

*This documentation is maintained by the ComLab System Administration Team.  
For updates or corrections, contact: danicaserdena7@gmail.com*
