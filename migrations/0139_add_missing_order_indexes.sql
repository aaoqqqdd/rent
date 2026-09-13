-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- orders is queried on every customer dashboard load (WHERE userId), every
-- admin/staff order list (WHERE status / deviceId), and the admin dashboard
-- aggregate counts (status, startDate, endDate). None of those columns had
-- an index, so these were full table scans.
CREATE INDEX IF NOT EXISTS idx_orders_userid ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_deviceid ON orders(deviceId);
CREATE INDEX IF NOT EXISTS idx_orders_start_date ON orders(startDate);
CREATE INDEX IF NOT EXISTS idx_orders_end_date ON orders(endDate);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_no_upper ON orders(UPPER(orderNo));
