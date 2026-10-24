-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

CREATE TABLE rental_links (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  device_id TEXT NOT NULL,
  pickup_location TEXT NOT NULL,
  return_location TEXT NOT NULL,
  device_condition TEXT NOT NULL,
  device_accessories TEXT,
  late_fee_per_day REAL NOT NULL DEFAULT 0 CHECK(late_fee_per_day >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(device_id) REFERENCES devices(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

ALTER TABLE orders ADD COLUMN rental_link_id TEXT REFERENCES rental_links(id);
ALTER TABLE orders ADD COLUMN booking_buffer_days INTEGER NOT NULL DEFAULT 0 CHECK(booking_buffer_days >= 0);
CREATE INDEX idx_orders_rental_link ON orders(rental_link_id);

-- 每次插入或改期时在数据库内核验，防止两个请求同时通过应用层档期检查。
CREATE TRIGGER rental_link_booking_insert
BEFORE INSERT ON orders
WHEN NEW.status NOT IN ('completed', 'cancelled') AND EXISTS (
    SELECT 1 FROM orders old
    WHERE old.id != NEW.id AND old.deviceId = NEW.deviceId
      AND old.status NOT IN ('completed', 'cancelled')
      AND (NEW.rental_link_id IS NOT NULL OR old.rental_link_id IS NOT NULL)
      AND (NEW.startDate IS NULL OR NEW.endDate IS NULL OR old.startDate IS NULL OR old.endDate IS NULL OR (
        julianday(NEW.startDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 THEN 0 WHEN NEW.startPeriod = 'PM' THEN 1 ELSE 0 END - MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
          < julianday(old.endDate) * 2 + CASE WHEN old.endPeriod = 'PM' THEN 1 ELSE 0 END
        AND julianday(old.startDate) * 2 + CASE WHEN old.startPeriod = 'PM' THEN 1 ELSE 0 END
          < julianday(NEW.endDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 OR NEW.endPeriod = 'PM' THEN 1 ELSE 0 END + MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
      ))
  )
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_BOOKING_CONFLICT');
END;

CREATE TRIGGER rental_link_booking_update
BEFORE UPDATE OF deviceId, startDate, endDate, startPeriod, endPeriod, status ON orders
WHEN NEW.status NOT IN ('completed', 'cancelled') AND EXISTS (
    SELECT 1 FROM orders old
    WHERE old.id != NEW.id AND old.deviceId = NEW.deviceId
      AND old.status NOT IN ('completed', 'cancelled')
      AND (NEW.rental_link_id IS NOT NULL OR old.rental_link_id IS NOT NULL)
      AND (NEW.startDate IS NULL OR NEW.endDate IS NULL OR old.startDate IS NULL OR old.endDate IS NULL OR (
        julianday(NEW.startDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 THEN 0 WHEN NEW.startPeriod = 'PM' THEN 1 ELSE 0 END - MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
          < julianday(old.endDate) * 2 + CASE WHEN old.endPeriod = 'PM' THEN 1 ELSE 0 END
        AND julianday(old.startDate) * 2 + CASE WHEN old.startPeriod = 'PM' THEN 1 ELSE 0 END
          < julianday(NEW.endDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 OR NEW.endPeriod = 'PM' THEN 1 ELSE 0 END + MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
      ))
  )
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_BOOKING_CONFLICT');
END;

CREATE TRIGGER rental_link_enabled_insert
BEFORE INSERT ON orders
WHEN NEW.rental_link_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM rental_links l JOIN devices d ON d.id = l.device_id JOIN users u ON u.id = l.created_by
  WHERE l.id = NEW.rental_link_id AND l.device_id = NEW.deviceId AND l.enabled = 1
    AND d.status NOT IN ('maintenance', 'retired') AND u.role = 'ADMIN' AND u.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_UNAVAILABLE');
END;
