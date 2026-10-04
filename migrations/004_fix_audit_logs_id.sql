-- Ensure audit log records receive an ID automatically.
-- Safe for existing records because it only adds AUTO_INCREMENT to the primary key.
ALTER TABLE audit_logs
  MODIFY COLUMN id INT NOT NULL,
  ADD PRIMARY KEY (id);

ALTER TABLE audit_logs
  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
