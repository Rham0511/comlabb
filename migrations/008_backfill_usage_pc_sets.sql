UPDATE equipment_usage_logs eul
INNER JOIN equipment e ON e.id = eul.equipmentId
SET eul.pcSetId = CONCAT(
  'PC-SET-',
  LPAD(TRIM(SUBSTRING_INDEX(e.name, 'PC Station ', -1)), 3, '0')
)
WHERE (eul.pcSetId IS NULL OR eul.pcSetId = '')
  AND e.name LIKE '%PC Station %'
  AND TRIM(SUBSTRING_INDEX(e.name, 'PC Station ', -1)) REGEXP '^[0-9]+$';
