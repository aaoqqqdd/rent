-- Migration 0044 rebuilt `devices` and SQLite rewrote existing child foreign
-- keys to the temporary parent name. D1 then dropped that temporary table,
-- causing inserts into rentals/contracts to fail with "no such table".
-- Keep a compatibility parent containing the same device ids while the
-- application continues using `devices` as the source of truth.
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS devices_before_retired_status (
  id TEXT PRIMARY KEY NOT NULL
);

INSERT OR IGNORE INTO devices_before_retired_status (id)
SELECT id FROM devices;

CREATE TRIGGER IF NOT EXISTS sync_device_legacy_parent_insert
AFTER INSERT ON devices
BEGIN
  INSERT OR IGNORE INTO devices_before_retired_status (id) VALUES (NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS sync_device_legacy_parent_delete
AFTER DELETE ON devices
BEGIN
  DELETE FROM devices_before_retired_status WHERE id = OLD.id;
END;

PRAGMA foreign_keys=ON;
