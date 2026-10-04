-- Add explicit statuses required for current equipment monitoring.
ALTER TABLE equipment
  MODIFY COLUMN status ENUM(
    'Serviceable',
    'Unserviceable',
    'Lost',
    'Missing',
    'Under Maintenance',
    'In Use',
    'For Repair',
    'For Disposal'
  ) NOT NULL DEFAULT 'Serviceable';
