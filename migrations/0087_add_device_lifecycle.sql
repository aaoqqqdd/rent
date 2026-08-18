-- Keep the existing devices.status field for legacy availability checks while
-- tracking the operational lifecycle separately.
ALTER TABLE devices ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'READY'
  CHECK(lifecycle_status IN ('RESERVED', 'READY', 'RENTED', 'RETURNED', 'INSPECTION', 'MAINTENANCE', 'DAMAGED', 'RETIRED'));

UPDATE devices
SET lifecycle_status = CASE status
  WHEN 'rented' THEN 'RENTED'
  WHEN 'maintenance' THEN 'MAINTENANCE'
  WHEN 'retired' THEN 'RETIRED'
  ELSE 'READY'
END;

CREATE TABLE IF NOT EXISTS device_lifecycle_events (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  order_id TEXT,
  previous_status TEXT,
  next_status TEXT NOT NULL CHECK(next_status IN ('RESERVED', 'READY', 'RENTED', 'RETURNED', 'INSPECTION', 'MAINTENANCE', 'DAMAGED', 'RETIRED')),
  reason TEXT,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_lifecycle_events_device_created ON device_lifecycle_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_lifecycle_status ON devices(lifecycle_status);
