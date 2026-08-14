CREATE TABLE IF NOT EXISTS device_unavailable_dates (
  device_id TEXT NOT NULL,
  unavailable_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, unavailable_date),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_device_unavailable_date ON device_unavailable_dates(unavailable_date, device_id);
