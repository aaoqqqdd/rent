ALTER TABLE devices ADD COLUMN cleanup_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN cleanup_requested_at TEXT;
ALTER TABLE devices ADD COLUMN cleanup_completed_at TEXT;
ALTER TABLE devices ADD COLUMN cleanup_result TEXT;

CREATE INDEX IF NOT EXISTS idx_devices_cleanup_requested ON devices(cleanup_requested, agent_status);
