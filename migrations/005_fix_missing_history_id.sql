-- Ensure missing/found/transfer history records receive an ID automatically.
ALTER TABLE missing_equipment_history
  MODIFY COLUMN id INT NOT NULL,
  ADD PRIMARY KEY (id);

ALTER TABLE missing_equipment_history
  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
