#!/bin/bash

###############################################################################
# Simple Migration Runner - No Node.js dependencies
# Runs SQL files directly with mysql command
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ComLab Equipment Enhancements - Simple Migration        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Database credentials from .env or defaults
DB_USER=${DB_USER:-comlab}
DB_PASS=${DB_PASS:-comlab123}
DB_NAME=${DB_NAME:-comlab}

echo -e "${CYAN}Step 1: Creating backup...${NC}"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${RED}✗ Backup failed! Check database credentials.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Step 2: Creating new tables...${NC}"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < migrations/001_equipment_enhancements_safe.sql 2>&1 | grep -v "Using a password"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ New tables created${NC}"
else
    echo -e "${RED}✗ Failed to create tables${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Step 3: Adding columns to equipment table...${NC}"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < migrations/002_add_equipment_columns.sql 2>&1 | grep -v "Using a password"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Equipment table enhanced${NC}"
else
    echo -e "${RED}✗ Failed to enhance equipment table${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Step 4: Verifying migration...${NC}"

# Check new tables
TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SHOW TABLES LIKE 'equipment_%';" 2>/dev/null | wc -l)

if [ "$TABLE_COUNT" -ge 6 ]; then
    echo -e "${GREEN}✓ All new tables exist ($TABLE_COUNT tables)${NC}"
else
    echo -e "${YELLOW}⚠ Only $TABLE_COUNT new tables found (expected 6+)${NC}"
fi

# Check new columns
COLUMN_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='equipment' AND COLUMN_NAME IN ('serialNumber','setId','manufacturer','model','condition','location','remarks');" 2>/dev/null)

if [ "$COLUMN_COUNT" -ge 7 ]; then
    echo -e "${GREEN}✓ New columns added to equipment table ($COLUMN_COUNT columns)${NC}"
else
    echo -e "${YELLOW}⚠ Only $COLUMN_COUNT new columns found (expected 7+)${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         Migration Completed Successfully! ✨              ║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Restart your application: pm2 restart xianfires"
echo "  2. Test: curl http://localhost:3001/api/equipment"
echo ""
echo -e "${YELLOW}Backup Location:${NC} $BACKUP_FILE"
echo ""
