# 🔄 Development Workflow Guide

## Quick Reference

```
Localhost → GitHub → Deployed Server
```

---

## 📝 WORKFLOW

### **On Localhost (Your Computer)**

#### 1. **First Time Setup**
```bash
# Clone repository
git clone https://github.com/Rham0511/comlabb.git
cd comlabb

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your LOCAL database settings

# Create local database
mysql -u root -p
CREATE DATABASE comlabfacilities_db;
exit;

# Run migrations
bash run-migrations-simple.sh

# Start development server
npm start
# Or: node server.js
```

#### 2. **Daily Development**
```bash
# Start working
cd comlabb
npm start

# Make your changes in VS Code or any editor
# Test locally at http://localhost:3000

# When ready to deploy:
git status              # Check what changed
git add -A              # Stage all changes
git commit -m "Your descriptive message here"
git push origin main    # Push to GitHub
```

---

### **On Deployed Server (Ubuntu EC2)**

#### 3. **Deploy Updates**
```bash
# SSH into server
ssh ubuntu@your-server-ip

# Navigate to project
cd /home/ubuntu/ComLab

# Run deploy script
bash deploy-update.sh
```

**The script automatically:**
- ✅ Backs up database
- ✅ Pulls latest code from GitHub
- ✅ Installs new dependencies
- ✅ Runs database migrations
- ✅ Restarts PM2 application
- ✅ Shows status

---

## 🚨 Manual Commands (if needed)

### Update Code Only
```bash
cd /home/ubuntu/ComLab
git pull origin main
pm2 restart xianfires
```

### Update Dependencies
```bash
cd /home/ubuntu/ComLab
npm install --production
pm2 restart xianfires
```

### Check Application Status
```bash
pm2 status
pm2 logs xianfires --lines 50
```

### Manual Database Backup
```bash
cd /home/ubuntu/ComLab
mysqldump -u root -p comlabfacilities_db > backups/manual-backup-$(date +%Y%m%d_%H%M%S).sql
```

---

## 📂 Important Files

- **`.env`** - Environment variables (NEVER commit this)
- **`.env.example`** - Template for .env
- **`server.js`** - Main application entry point
- **`package.json`** - Dependencies and scripts
- **`deploy-update.sh`** - Automated deployment script

---

## 🔐 Environment Files

### Localhost `.env` (example)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=comlabfacilities_db
PORT=3000
SESSION_SECRET=dev-secret-key
```

### Deployed Server `.env` (already configured)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_production_password
DB_NAME=comlabfacilities_db
PORT=3000
SESSION_SECRET=production-secret-key
```

---

## ✅ Best Practices

1. **Always test on localhost first** before pushing
2. **Commit often** with descriptive messages
3. **Check `git status`** before committing
4. **Review changes** with `git diff` if unsure
5. **Backup database** before major updates (done automatically by deploy script)
6. **Never commit `.env`** files with secrets
7. **Use meaningful commit messages**:
   - ✅ "Add PC Set reporting with attendance validation"
   - ❌ "fix stuff"

---

## 🐛 Troubleshooting

### If deployment fails:
```bash
cd /home/ubuntu/ComLab
git status              # Check for conflicts
git pull origin main    # Try pulling again
pm2 logs xianfires      # Check error logs
```

### If database migration fails:
```bash
cd /home/ubuntu/ComLab
mysql -u root -p comlabfacilities_db < backups/latest-backup.sql
```

### If npm install fails:
```bash
cd /home/ubuntu/ComLab
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --production
```

---

## 📞 Common Git Commands

```bash
# Check status
git status

# See what changed
git diff

# Undo changes (before commit)
git restore <filename>
git restore .                    # Undo all changes

# View commit history
git log --oneline -10

# Create a new branch
git checkout -b feature-name

# Switch branches
git checkout main

# Pull latest without deploying
git fetch origin
git log origin/main              # See what's new
```

---

## 🎯 Typical Workflow Example

```bash
# === ON LOCALHOST ===
cd comlabb
git pull origin main             # Get latest changes
# (make your changes)
npm start                        # Test locally
git add -A
git commit -m "Add equipment filter by campus"
git push origin main

# === ON DEPLOYED SERVER ===
ssh ubuntu@your-server
cd /home/ubuntu/ComLab
bash deploy-update.sh
# Done! Changes are live.
```

---

## 🔗 Repository
https://github.com/Rham0511/comlabb.git

## 🌐 Live Site
https://comlabfacilitiesms.cyou
