-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

ALTER TABLE payments ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE payments ADD COLUMN stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session
ON payments(stripe_checkout_session_id)
WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_refunds (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'cancellation')),
  refundable_amount REAL NOT NULL,
  refund_amount REAL NOT NULL,
  deduction_amount REAL NOT NULL DEFAULT 0,
  deduction_reason TEXT,
  stripe_refund_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('succeeded', 'failed')),
  processed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_deposit_once
ON payment_refunds(order_id, type)
WHERE type = 'deposit' AND status = 'succeeded';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_cancellation_once
ON payment_refunds(order_id, type)
WHERE type = 'cancellation' AND status = 'succeeded';

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
