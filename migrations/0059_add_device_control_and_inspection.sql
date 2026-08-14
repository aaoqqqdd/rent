ALTER TABLE devices ADD COLUMN device_mode TEXT NOT NULL DEFAULT 'normal' CHECK(device_mode IN ('normal', 'return', 'maintenance', 'lost'));
ALTER TABLE devices ADD COLUMN remote_lock_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN remote_lock_message TEXT;
ALTER TABLE devices ADD COLUMN contract_link TEXT;

CREATE TABLE IF NOT EXISTS device_inspections (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  rental_id TEXT,
  inspection_type TEXT NOT NULL CHECK(inspection_type IN ('before_rental', 'after_return', 'automated_health')),
  snapshot_json TEXT NOT NULL,
  differences_json TEXT,
  performed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_health_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_inspections_device ON device_inspections(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_health_alerts_open ON device_health_alerts(device_id, resolved_at);
