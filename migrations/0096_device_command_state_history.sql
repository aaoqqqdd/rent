CREATE TABLE IF NOT EXISTS device_command_state_history (
  id TEXT PRIMARY KEY NOT NULL,
  command_id TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_command_state_history_command ON device_command_state_history(command_id, created_at);

CREATE TRIGGER IF NOT EXISTS device_commands_state_insert
AFTER INSERT ON device_commands BEGIN
  INSERT INTO device_command_state_history (id, command_id, next_status, reason)
  VALUES ('dcs-' || lower(hex(randomblob(16))), NEW.id, NEW.status, '命令已创建');
END;
CREATE TRIGGER IF NOT EXISTS device_commands_state_update
AFTER UPDATE OF status ON device_commands WHEN OLD.status <> NEW.status BEGIN
  INSERT INTO device_command_state_history (id, command_id, previous_status, next_status, reason)
  VALUES ('dcs-' || lower(hex(randomblob(16))), NEW.id, OLD.status, NEW.status, NEW.error_message);
END;
