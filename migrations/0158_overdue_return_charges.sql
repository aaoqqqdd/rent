-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- One row for the late-return handling fee on the due date and one row for
-- each subsequent overdue rental day. The unique key makes the cron safe to
-- retry without charging a day twice.
CREATE TABLE IF NOT EXISTS overdue_return_charges (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  charge_date TEXT NOT NULL,
  rental_amount REAL NOT NULL DEFAULT 0,
  handling_fee REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, charge_date)
);

CREATE INDEX IF NOT EXISTS idx_overdue_return_charges_order
  ON overdue_return_charges(order_id, charge_date);

ALTER TABLE orders ADD COLUMN overdue_charge_total REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN overdue_deposit_applied REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN overdue_outstanding_amount REAL NOT NULL DEFAULT 0;
