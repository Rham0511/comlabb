# 🗄️ Database Synchronization Guide

## 📋 Overview

**Important:** Database and code are handled separately!

```
Code:     Localhost → GitHub → Server (automatic)
Database: Manual sync (choose your approach below)
```

---

## 🎯 Option 1: Separate Databases (Recommended)

Use different data on localhost vs production.

### **Setup Localhost with Test Data**

```bash
# On your localhost
cd comlabb

# Create local database
mysql -u root -p
CREATE DATABASE comlabfacilities_db;
exit;

# Run migrations to create tables
bash run-migrations-simple.sh

# Add test data manually through the app
# Or create a seed script
```

**Pros:**
- ✅ Safe - can't accidentally break production data
- ✅ Fast - no large file transfers
- ✅ Independent development

**Cons:**
- ❌ Not testing with real data

---

## 🎯 Option 2: Copy Production DB to Localhost

Use real production data on localhost for testing.

### **Step 1: Export from Server**

```bash
# SSH into server
ssh ubuntu@your-server-ip

# Run export script
cd /home/ubuntu/ComLab
bash export-database.sh

# Enter your MySQL password when prompted
```

This creates a file like: `/home/ubuntu/ComLab/db-exports/comlabdb-export-20241003_045030.sql`

### **Step 2: Download to Your Computer**

**Method A: Using SCP (recommended)**
```bash
# On your localhost terminal
scp ubuntu@your-server-ip:/home/ubuntu/ComLab/db-exports/comlabdb-export-*.sql ~/Downloads/
```

**Method B: Copy-Paste**
```bash
# On server
cat /home/ubuntu/ComLab/db-exports/comlabdb-export-*.sql

# Copy the output, paste into a file on localhost
```

**Method C: Using SFTP client**
- Use FileZilla, WinSCP, or Cyberduck
- Connect to server
- Download the .sql file

### **Step 3: Import to Localhost**

```bash
# On your localhost
cd comlabb

# Import the database
mysql -u root -p comlabfacilities_db < ~/Downloads/comlabdb-export-*.sql
```

**Pros:**
- ✅ Testing with real data
- ✅ See actual user scenarios

**Cons:**
- ❌ Contains sensitive production data
- ❌ Large file transfers
- ❌ Must be careful not to push secrets

---

## 🎯 Option 3: Schema Only (Tables without data)

Get just the structure, add your own test data.

### **Export Schema Only**

```bash
# On server
mysqldump -u root -p --no-data comlabfacilities_db > /home/ubuntu/ComLab/db-exports/schema-only.sql

# Download and import to localhost
mysql -u root -p comlabfacilities_db < schema-only.sql
```

---

## 🚫 What NOT to Do

❌ **Never push production database to GitHub**
❌ **Never commit `.sql` files with real data**
❌ **Never sync databases automatically** (too risky)
❌ **Never use production DB directly from localhost** (security risk)

---

## 📊 Migration Files

When you **change the database structure** (add tables, columns, etc.):

### **Create Migration File**

```bash
# On localhost, create file like:
migrations/012_add_new_feature.sql
```

Example content:
```sql
-- Add new column to equipment table
ALTER TABLE equipment ADD COLUMN warranty_expiry DATE;

-- Create new table
CREATE TABLE equipment_warranty (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id VARCHAR(50),
    warranty_start DATE,
    warranty_end DATE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipmentId)
);
```

### **Deployment Process**

```bash
# 1. Commit migration to GitHub (localhost)
git add migrations/012_add_new_feature.sql
git commit -m "Add warranty tracking"
git push origin main

# 2. Deploy to server
cd /home/ubuntu/ComLab
bash deploy-update.sh
# The script automatically runs migrations
```

---

## 🔄 Complete Workflow Examples

### **Example 1: Adding New Feature with DB Changes**

```bash
# === LOCALHOST ===
cd comlabb

# 1. Create migration file
echo "ALTER TABLE users ADD COLUMN phone VARCHAR(20);" > migrations/013_add_phone.sql

# 2. Run migration locally
mysql -u root -p comlabfacilities_db < migrations/013_add_phone.sql

# 3. Update code to use new column
# (edit files)

# 4. Test locally
npm start

# 5. Commit and push
git add migrations/013_add_phone.sql
git add controllers/userController.js
git commit -m "Add phone number field to users"
git push origin main

# === SERVER ===
ssh ubuntu@your-server
cd /home/ubuntu/ComLab
bash deploy-update.sh
# Done! Migration runs automatically
```

### **Example 2: Testing with Production Data**

```bash
# === SERVER ===
ssh ubuntu@your-server
cd /home/ubuntu/ComLab
bash export-database.sh
# (creates export file)

# === LOCALHOST ===
# Download the .sql file
scp ubuntu@your-server:/home/ubuntu/ComLab/db-exports/latest.sql ~/Downloads/

# Import to local database
mysql -u root -p comlabfacilities_db < ~/Downloads/latest.sql

# Now you have production data locally
npm start
# Test your changes with real data
```

---

## 🔐 Security Tips

1. **Never commit database dumps** to GitHub
2. **Add to .gitignore:**
   ```
   *.sql
   db-exports/
   backups/
   ```
3. **Sanitize production data** before using locally:
   ```sql
   -- Remove sensitive data
   UPDATE users SET password = 'test123', email = CONCAT('user', id, '@test.com');
   ```

---

## 📂 Important Directories

```
/home/ubuntu/ComLab/
├── migrations/           # SQL migration files (committed to git)
├── backups/             # Auto backups (NOT in git)
├── db-exports/          # Manual exports (NOT in git)
└── .gitignore           # Excludes backups/exports
```

---

## 🆘 Troubleshooting

### "Table doesn't exist" error
```bash
# Check if migrations ran
cd /home/ubuntu/ComLab
bash run-migrations-simple.sh
```

### Import failed
```bash
# Check MySQL syntax
mysql -u root -p comlabfacilities_db < file.sql 2>&1 | head -20
```

### Database too large
```bash
# Export with compression
mysqldump -u root -p comlabfacilities_db | gzip > export.sql.gz

# Import compressed
gunzip < export.sql.gz | mysql -u root -p comlabfacilities_db
```

---

## ✅ Best Practice: Recommended Approach

**For most development:**
1. Use **separate test database** on localhost
2. Create **seed data script** for common test scenarios
3. Use **migrations** for schema changes
4. Occasionally **download production DB** to test edge cases
5. **Never push** database files to GitHub

**For deployment:**
1. Code changes → GitHub (automatic with `git push`)
2. DB schema changes → migrations folder → GitHub
3. DB data → stays on each server (not synced)

This keeps development fast and production data safe! 🎯
