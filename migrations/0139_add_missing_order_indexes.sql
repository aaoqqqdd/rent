-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Admin/staff order list pages filter and join on these columns on every
-- request; without indexes each filtered query is a full table scan.
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_deviceId ON orders(deviceId);
CREATE INDEX IF NOT EXISTS idx_orders_startDate ON orders(startDate);
CREATE INDEX IF NOT EXISTS idx_orders_endDate ON orders(endDate);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_orders_orderNo_upper ON orders(UPPER(orderNo));

-- Staff/admin contract list pages filter by status alongside the existing
-- idx_contracts_created_by index.
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
