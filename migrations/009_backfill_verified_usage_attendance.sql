-- This legacy record has a verified attendance match after accounting for the
-- existing UTC/local-time offset in the imported records.
UPDATE equipment_usage_logs
SET attendanceId = 6649
WHERE id = 4
  AND attendanceId IS NULL
  AND userId = 61;
