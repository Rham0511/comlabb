-- Link every maintenance request to the equipment serial number.
-- Safe to run after the existing equipment enhancement migrations.

SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'maintenance_requests'
      AND COLUMN_NAME = 'serialNumber'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE maintenance_requests ADD COLUMN serialNumber VARCHAR(100) NULL COMMENT "Serial number of equipment needing maintenance"',
    'SELECT "maintenance_requests.serialNumber already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE maintenance_requests mr
INNER JOIN equipment e ON e.equipmentId = mr.equipmentId
SET mr.serialNumber = e.serialNumber
WHERE (mr.serialNumber IS NULL OR mr.serialNumber = '')
  AND e.serialNumber IS NOT NULL
  AND e.serialNumber <> '';

SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'maintenance_requests'
      AND INDEX_NAME = 'idx_maintenance_requests_serialNumber'
);

SET @sql = IF(
    @index_exists = 0,
    'CREATE INDEX idx_maintenance_requests_serialNumber ON maintenance_requests (serialNumber)',
    'SELECT "maintenance serial number index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
