ALTER TABLE equipment_usage_logs
  ADD COLUMN pcSetId VARCHAR(50) NULL AFTER laboratoryId;

CREATE INDEX idx_usage_pcSetId ON equipment_usage_logs (pcSetId);
