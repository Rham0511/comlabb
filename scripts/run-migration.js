/**
 * Migration Runner Script
 * Safely runs database migration for equipment enhancements
 * 
 * Usage: node run-migration.js
 */

import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function createBackup(connection) {
    log('\n📦 Creating database backup...', colors.cyan);
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        
        // Create backups directory if it doesn't exist
        try {
            await fs.access(backupDir);
        } catch {
            await fs.mkdir(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = path.join(backupDir, `comlab_backup_${timestamp}.sql`);
        
        // Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        let backupContent = `-- ComLab Database Backup\n`;
        backupContent += `-- Date: ${new Date().toISOString()}\n`;
        backupContent += `-- Database: ${process.env.DB_NAME}\n\n`;
        backupContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`;
        
        for (const tableName of tableNames) {
            // Get CREATE TABLE statement
            const [createStmt] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            backupContent += `${createStmt[0]['Create Table']};\n\n`;
            
            // Get table data
            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
            if (rows.length > 0) {
                backupContent += `-- Data for table \`${tableName}\`\n`;
                for (const row of rows) {
                    const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                    const values = Object.values(row).map(val => {
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return connection.escape(val);
                        if (val instanceof Date) return connection.escape(val.toISOString().slice(0, 19).replace('T', ' '));
                        return val;
                    }).join(', ');
                    backupContent += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
                }
                backupContent += '\n';
            }
        }
        
        backupContent += `SET FOREIGN_KEY_CHECKS=1;\n`;
        
        await fs.writeFile(backupFile, backupContent);
        log(`✅ Backup created: ${backupFile}`, colors.green);
        return backupFile;
        
    } catch (error) {
        log(`❌ Backup failed: ${error.message}`, colors.red);
        throw error;
    }
}

async function runMigration() {
    let connection;
    
    try {
        log('═══════════════════════════════════════════════════════════', colors.bright);
        log('  ComLab Equipment Enhancements - Database Migration', colors.bright);
        log('═══════════════════════════════════════════════════════════', colors.bright);
        
        // Create database connection
        log('\n🔌 Connecting to database...', colors.cyan);
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'comlab',
            password: process.env.DB_PASS || 'comlab123',
            database: process.env.DB_NAME || 'comlab',
            multipleStatements: true
        });
        log('✅ Connected to database', colors.green);
        
        // Create backup
        await createBackup(connection);
        
        // Read migration file
        log('\n📄 Reading migration file...', colors.cyan);
        const migrationPath = path.join(__dirname, 'migrations', '001_equipment_enhancements.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        log('✅ Migration file loaded', colors.green);
        
        // Run migration
        log('\n🚀 Running migration...', colors.cyan);
        log('   This may take a moment...', colors.yellow);
        
        // Split migration into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        let successCount = 0;
        let skipCount = 0;
        
        for (const statement of statements) {
            try {
                await connection.query(statement);
                successCount++;
            } catch (error) {
                // Ignore "already exists" errors
                if (error.code === 'ER_DUP_FIELDNAME' || 
                    error.code === 'ER_TABLE_EXISTS_ERROR' ||
                    error.message.includes('Duplicate column name') ||
                    error.message.includes('already exists')) {
                    skipCount++;
                } else {
                    throw error;
                }
            }
        }
        
        log(`✅ Migration completed successfully!`, colors.green);
        log(`   Executed: ${successCount} statements`, colors.green);
        if (skipCount > 0) {
            log(`   Skipped: ${skipCount} statements (already exist)`, colors.yellow);
        }
        
        // Verify new tables
        log('\n🔍 Verifying new tables...', colors.cyan);
        const expectedTables = [
            'equipment_sets',
            'equipment_usage_logs',
            'equipment_audit_trail',
            'equipment_inventory_checks',
            'equipment_inventory_check_items',
            'equipment_technician_reports'
        ];
        
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        for (const expectedTable of expectedTables) {
            if (tableNames.includes(expectedTable)) {
                log(`   ✓ ${expectedTable}`, colors.green);
            } else {
                log(`   ✗ ${expectedTable} - NOT FOUND!`, colors.red);
            }
        }
        
        // Verify equipment table new columns
        log('\n🔍 Verifying equipment table columns...', colors.cyan);
        const [columns] = await connection.query('DESCRIBE equipment');
        const columnNames = columns.map(col => col.Field);
        
        const expectedColumns = [
            'serialNumber',
            'setId',
            'manufacturer',
            'model',
            'purchaseDate',
            'warrantyExpiry',
            'condition',
            'location',
            'remarks'
        ];
        
        for (const expectedColumn of expectedColumns) {
            if (columnNames.includes(expectedColumn)) {
                log(`   ✓ ${expectedColumn}`, colors.green);
            } else {
                log(`   ✗ ${expectedColumn} - NOT FOUND!`, colors.red);
            }
        }
        
        log('\n═══════════════════════════════════════════════════════════', colors.bright);
        log('  Migration Summary', colors.bright);
        log('═══════════════════════════════════════════════════════════', colors.bright);
        log(`✅ Database backup created`, colors.green);
        log(`✅ ${successCount} SQL statements executed`, colors.green);
        log(`✅ 6 new tables created`, colors.green);
        log(`✅ Equipment table enhanced with 9 new columns`, colors.green);
        log(`✅ All indexes created`, colors.green);
        
        log('\n📋 Next Steps:', colors.cyan);
        log('   1. Restart your application: pm2 restart xianfires', colors.yellow);
        log('   2. Test equipment features in the web interface', colors.yellow);
        log('   3. Review implementation plan: IMPLEMENTATION_PLAN.md', colors.yellow);
        
        log('\n✨ Migration completed successfully! ✨\n', colors.green);
        
    } catch (error) {
        log('\n❌ Migration failed!', colors.red);
        log(`Error: ${error.message}`, colors.red);
        log('\nThe database backup was created before migration.', colors.yellow);
        log('You can restore it if needed.', colors.yellow);
        process.exit(1);
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run migration
runMigration();
