#!/bin/bash
# ComLab Deployment Update Script
# Run this after pushing changes from localhost to GitHub

set -e  # Exit on error

echo "🚀 Starting ComLab deployment update..."
echo ""

# Step 1: Backup current database
echo "📦 Backing up database..."
BACKUP_DIR="/home/ubuntu/ComLab/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-update-$(date +%Y%m%d_%H%M%S).sql"
mysqldump -u root -p comlabfacilities_db > "$BACKUP_FILE" 2>/dev/null || {
    echo "⚠️  Database backup failed (you may need to enter password manually)"
    mysqldump -u root -p comlabfacilities_db > "$BACKUP_FILE"
}
echo "✅ Database backed up to: $BACKUP_FILE"
echo ""

# Step 2: Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git pull origin main
echo "✅ Code updated"
echo ""

# Step 3: Install new dependencies (if any)
echo "📦 Installing dependencies..."
npm install --production
echo "✅ Dependencies updated"
echo ""

# Step 4: Run database migrations (if any)
if [ -f "run-migrations-simple.sh" ]; then
    echo "🗄️  Running database migrations..."
    bash run-migrations-simple.sh
    echo "✅ Migrations completed"
else
    echo "ℹ️  No migration script found, skipping..."
fi
echo ""

# Step 5: Restart the application
echo "♻️  Restarting application..."
pm2 restart xianfires --update-env
sleep 3
pm2 logs xianfires --lines 5 --nostream
echo "✅ Application restarted"
echo ""

# Step 6: Show status
echo "📊 Current status:"
pm2 status xianfires
echo ""

echo "✅ Deployment update complete!"
echo ""
echo "🌐 Your site should now be running the latest code from GitHub"
echo "🔗 Visit: https://comlabfacilitiesms.cyou"
