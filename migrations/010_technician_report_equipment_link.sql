ALTER TABLE equipment_technician_reports
  ADD COLUMN equipmentId INT NULL AFTER technicianName,
  ADD COLUMN serialNumber VARCHAR(100) NULL AFTER equipmentId,
  ADD COLUMN issueType VARCHAR(50) NULL AFTER serialNumber;

CREATE INDEX idx_technician_report_equipment ON equipment_technician_reports (equipmentId);
CREATE INDEX idx_technician_report_serial ON equipment_technician_reports (serialNumber);
