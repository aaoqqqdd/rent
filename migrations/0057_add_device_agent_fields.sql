-- Windows device agent registration and heartbeat state.
ALTER TABLE devices ADD COLUMN agent_token_hash TEXT;
ALTER TABLE devices ADD COLUMN agent_registered_at TEXT;
ALTER TABLE devices ADD COLUMN agent_last_seen_at TEXT;
ALTER TABLE devices ADD COLUMN agent_last_ip TEXT;
ALTER TABLE devices ADD COLUMN agent_hostname TEXT;
ALTER TABLE devices ADD COLUMN agent_os_version TEXT;
ALTER TABLE devices ADD COLUMN agent_cpu TEXT;
ALTER TABLE devices ADD COLUMN agent_memory_mb INTEGER;
ALTER TABLE devices ADD COLUMN agent_storage_free_bytes INTEGER;
ALTER TABLE devices ADD COLUMN agent_status TEXT NOT NULL DEFAULT 'unregistered' CHECK(agent_status IN ('unregistered', 'online', 'offline', 'paused'));

CREATE INDEX IF NOT EXISTS idx_devices_agent_token_hash ON devices(agent_token_hash);
CREATE INDEX IF NOT EXISTS idx_devices_agent_status ON devices(agent_status);
