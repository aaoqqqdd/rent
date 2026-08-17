CREATE TABLE IF NOT EXISTS device_commands (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  command_type TEXT NOT NULL CHECK(command_type IN ('SYNC', 'SHOW_MESSAGE', 'PAUSE_RENTAL', 'RESUME_RENTAL', 'REFRESH_DEVICE_INFO', 'CHECK_UPDATE')),
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'DELIVERED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_device_commands_poll ON device_commands(device_id, status, expires_at, created_at);
CREATE TABLE IF NOT EXISTS device_command_results (
  id TEXT PRIMARY KEY NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  result_code TEXT NOT NULL,
  result_message TEXT,
  executed_at TEXT NOT NULL,
  reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (command_id) REFERENCES device_commands(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
