#!/bin/bash
# Export production database for download

echo "📦 Exporting production database..."

EXPORT_DIR="/home/ubuntu/ComLab/db-exports"
mkdir -p "$EXPORT_DIR"

EXPORT_FILE="$EXPORT_DIR/comlabdb-export-$(date +%Y%m%d_%H%M%S).sql"

echo "Creating dump file..."
mysqldump -u root -p comlabfacilities_db > "$EXPORT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Database exported successfully!"
    echo ""
    echo "📁 Export file: $EXPORT_FILE"
    echo ""
    echo "📥 To download to your localhost:"
    echo "   scp ubuntu@your-server-ip:$EXPORT_FILE ~/Downloads/"
    echo ""
    echo "📥 Or copy the file content and paste to localhost"
    ls -lh "$EXPORT_FILE"
else
    echo "❌ Export failed!"
    exit 1
fi
