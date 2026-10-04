-- ============================================================================
-- ADD NEW COLUMNS TO EQUIPMENT TABLE
-- These will fail silently if columns already exist (handled by script)
-- ============================================================================

-- Check and add serialNumber
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'serialNumber'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN serialNumber VARCHAR(100) UNIQUE NULL COMMENT "Unique serial number for equipment identification"',
    'SELECT "Column serialNumber already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add setId
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'setId'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN setId VARCHAR(50) NULL COMMENT "Groups equipment into sets"',
    'SELECT "Column setId already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add manufacturer
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'manufacturer'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN manufacturer VARCHAR(100) NULL COMMENT "Equipment manufacturer"',
    'SELECT "Column manufacturer already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add model
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'model'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN model VARCHAR(100) NULL COMMENT "Equipment model number"',
    'SELECT "Column model already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add purchaseDate
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'purchaseDate'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN purchaseDate DATE NULL COMMENT "Date equipment was purchased"',
    'SELECT "Column purchaseDate already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add warrantyExpiry
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'warrantyExpiry'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN warrantyExpiry DATE NULL COMMENT "Warranty expiration date"',
    'SELECT "Column warrantyExpiry already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add condition
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'condition'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN `condition` ENUM("excellent", "good", "fair", "poor", "broken") DEFAULT "good" NULL COMMENT "Current physical condition"',
    'SELECT "Column condition already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add location
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'location'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN location VARCHAR(255) NULL COMMENT "Current physical location in lab"',
    'SELECT "Column location already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add remarks
SET @column_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment' 
    AND COLUMN_NAME = 'remarks'
);

SET @sql = IF(@column_check = 0,
    'ALTER TABLE equipment ADD COLUMN remarks TEXT NULL COMMENT "Additional notes about the equipment"',
    'SELECT "Column remarks already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equipment_serialNumber ON equipment(serialNumber);
CREATE INDEX IF NOT EXISTS idx_equipment_setId ON equipment(setId);

SELECT 'Equipment table enhanced with new columns' AS status;
