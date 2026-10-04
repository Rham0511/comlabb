-- Match weekly inventory campus identifiers to the existing equipment.campus values.
ALTER TABLE equipment_inventory_checks
  MODIFY COLUMN campusId VARCHAR(255) NOT NULL;
