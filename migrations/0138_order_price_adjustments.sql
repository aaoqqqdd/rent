-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 订单价格调整：记录补差价及转账类付款待退差价，避免重复收款/退款。
CREATE TABLE IF NOT EXISTS order_price_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('increase', 'decrease')),
  before_total REAL NOT NULL,
  after_total REAL NOT NULL,
  amount REAL NOT NULL,
  processing_fee REAL NOT NULL DEFAULT 0,
  payment_id TEXT,
  stripe_refund_id TEXT,
  refund_method TEXT CHECK(refund_method IN ('stripe', 'balance', 'pending_deposit')),
  deposit_refunded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'succeeded', 'failed')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_price_adjustments_order
ON order_price_adjustments(order_id, direction, status, created_at);
