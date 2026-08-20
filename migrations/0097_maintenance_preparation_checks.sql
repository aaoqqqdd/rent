CREATE TABLE IF NOT EXISTS maintenance_preparation_checks (
  id TEXT PRIMARY KEY NOT NULL,
  maintenance_id TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK(check_type IN ('DATA_WIPE','SYSTEM_RESET','WINDOWS_BOOT','AGENT_INSTALLED','AGENT_VERSION','DEVICE_SERIAL','DISK_HEALTH','NETWORK','HARDWARE','ACCESSORIES')),
  passed INTEGER NOT NULL,
  details TEXT,
  verified_by TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(maintenance_id, check_type)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_checks_record ON maintenance_preparation_checks(maintenance_id, verified_at);
