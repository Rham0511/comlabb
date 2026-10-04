-- Preserve the exact return timestamp and serial number for borrowing transactions.
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE borrow_records ADD COLUMN returnTime VARCHAR(5) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrow_records'
    AND COLUMN_NAME = 'returnTime'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE borrow_histories ADD COLUMN serialNumber VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrow_histories'
    AND COLUMN_NAME = 'serialNumber'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE borrow_histories ADD COLUMN returnTime VARCHAR(5) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrow_histories'
    AND COLUMN_NAME = 'returnTime'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
