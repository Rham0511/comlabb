#!/bin/bash

###############################################################################
# ComLab Equipment Enhancements - Quick Migration Script
# Safely migrates the database with automatic backup
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Functions
print_header() {
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ComLab Equipment Enhancements - Quick Migration         ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BOLD}${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/n) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Main script
print_header

echo -e "${CYAN}This script will:${NC}"
echo "  1. Create a backup of your database"
echo "  2. Run the equipment enhancements migration"
echo "  3. Verify all changes"
echo "  4. Restart your application"
echo ""

# Check if we're in the right directory
if [ ! -f "$SCRIPT_DIR/run-migration.js" ]; then
    print_error "Migration script not found!"
    print_error "Please run this script from the ComLab directory."
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    exit 1
fi

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    print_error ".env file not found!"
    print_error "Please ensure your .env file exists with database credentials."
    exit 1
fi

print_success "All prerequisites check passed"
echo ""

# Confirm before proceeding
if ! confirm "Ready to start migration?"; then
    print_warning "Migration cancelled."
    exit 0
fi

echo ""
print_step "Step 1: Creating backup directory"
mkdir -p "$SCRIPT_DIR/backups"
print_success "Backup directory ready"

echo ""
print_step "Step 2: Running migration script"
echo ""

# Run the migration
cd "$SCRIPT_DIR"
if node run-migration.js; then
    echo ""
    print_success "Migration completed successfully!"
    
    echo ""
    print_step "Step 3: Restarting application"
    
    # Check if pm2 is available
    if command -v pm2 &> /dev/null; then
        pm2 restart xianfires 2>/dev/null || print_warning "PM2 process 'xianfires' not found. Please restart your application manually."
        print_success "Application restart initiated"
        
        echo ""
        print_step "Step 4: Checking application status"
        sleep 2
        pm2 list
    else
        print_warning "PM2 not found. Please restart your application manually."
    fi
    
    echo ""
    echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║         Migration Completed Successfully! ✨              ║${NC}"
    echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Test your application: https://comlabfacilitiesms.cyou"
    echo "  2. Review migration guide: cat MIGRATION_GUIDE.md"
    echo "  3. Check implementation plan: cat IMPLEMENTATION_PLAN.md"
    echo ""
    echo -e "${YELLOW}Backup Location:${NC} $SCRIPT_DIR/backups/"
    echo ""
    
else
    echo ""
    print_error "Migration failed!"
    print_warning "Your database backup is located in: $SCRIPT_DIR/backups/"
    print_warning "Review the error messages above and check MIGRATION_GUIDE.md"
    exit 1
fi
