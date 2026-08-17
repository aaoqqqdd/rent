-- Windows tenant account lifecycle commands.
ALTER TABLE device_commands RENAME TO device_commands_legacy;
CREATE TABLE device_commands (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  command_type TEXT NOT NULL CHECK(command_type IN ('SYNC', 'SHOW_MESSAGE', 'PAUSE_RENTAL', 'RESUME_RENTAL', 'REFRESH_DEVICE_INFO', 'CHECK_UPDATE', 'CREATE_RENTAL_USER', 'UPDATE_RENTAL_USER', 'DELETE_RENTAL_USER')),
  payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, claimed_at TEXT, completed_at TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id), FOREIGN KEY (created_by) REFERENCES users(id)
);
INSERT INTO device_commands SELECT * FROM device_commands_legacy;
DROP TABLE device_commands_legacy;
CREATE INDEX IF NOT EXISTS idx_device_commands_poll ON device_commands(device_id, status, expires_at, created_at);
