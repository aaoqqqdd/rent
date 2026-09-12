-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- NULL means that the device inherits the corresponding global rental rule.
ALTER TABLE devices ADD COLUMN minimum_rental_days INTEGER CHECK (minimum_rental_days IS NULL OR minimum_rental_days >= 1);
ALTER TABLE devices ADD COLUMN buffer_days INTEGER CHECK (buffer_days IS NULL OR buffer_days >= 0);

CREATE TABLE IF NOT EXISTS device_unavailable_time_slots (
  device_id TEXT NOT NULL,
  unavailable_date TEXT NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning_service', 'morning', 'afternoon', 'evening_service', 'delivery_morning', 'delivery_afternoon')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, unavailable_date, time_slot),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_device_unavailable_time_slot ON device_unavailable_time_slots(unavailable_date, device_id);
