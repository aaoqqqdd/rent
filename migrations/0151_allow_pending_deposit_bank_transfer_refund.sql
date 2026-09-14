-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- The live payment_refunds.status CHECK only allows ('succeeded', 'failed'),
-- and .type only allows ('deposit', 'cancellation') -- yet application code
-- (cancelAndRefund, refundUnusedRentalDays, completeBankTransferRefund, and
-- their supporting index idx_payment_refunds_early_return_once) has always
-- inserted status = 'pending' and type = 'early_return' for bank-transfer
-- refunds awaiting manual completion. Those inserts violate the declared
-- CHECK and fail. This rebuilds the table with the constraints the code (and
-- the existing partial indexes/triggers below) already assume, and adds
-- admin_notified_at so an overdue-pending-bank-transfer sweep can dedupe
-- reminder notifications the same way payment_proofs.admin_notified_at does.
--
-- No other table has a FOREIGN KEY pointing at payment_refunds, so this is a
-- plain rename-rebuild-swap with no cascading FK concerns.

CREATE TABLE payment_refunds_new (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'cancellation', 'early_return')),
  refundable_amount REAL NOT NULL,
  refund_amount REAL NOT NULL,
  deduction_amount REAL NOT NULL DEFAULT 0,
  deduction_reason TEXT,
  stripe_refund_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed')),
  processed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refund_method TEXT NOT NULL DEFAULT 'balance' CHECK(refund_method IN ('balance', 'stripe', 'bank_transfer')),
  refund_bsb TEXT,
  refund_account_number TEXT,
  refund_account_name TEXT,
  refunded_processing_fee REAL NOT NULL DEFAULT 0,
  refund_number TEXT,
  deduction_category TEXT,
  admin_notified_at TEXT,
  FOREIGN KEY (processed_by) REFERENCES users(id)
);

INSERT INTO payment_refunds_new (
  id, order_id, payment_id, type, refundable_amount, refund_amount,
  deduction_amount, deduction_reason, stripe_refund_id, status, processed_by,
  created_at, refund_method, refund_bsb, refund_account_number,
  refund_account_name, refunded_processing_fee, refund_number, deduction_category
)
SELECT
  id, order_id, payment_id, type, refundable_amount, refund_amount,
  deduction_amount, deduction_reason, stripe_refund_id, status, processed_by,
  created_at, refund_method, refund_bsb, refund_account_number,
  refund_account_name, refunded_processing_fee, refund_number, deduction_category
FROM payment_refunds;

DROP TABLE payment_refunds;
ALTER TABLE payment_refunds_new RENAME TO payment_refunds;

CREATE UNIQUE INDEX idx_payment_refunds_cancellation_once
ON payment_refunds(order_id, type)
WHERE type = 'cancellation' AND status = 'succeeded';

CREATE UNIQUE INDEX idx_payment_refunds_early_return_once
ON payment_refunds(order_id, type)
WHERE type = 'early_return' AND status IN ('pending', 'succeeded');

CREATE UNIQUE INDEX idx_payment_refunds_refund_number ON payment_refunds(refund_number) WHERE refund_number IS NOT NULL;

CREATE INDEX idx_payment_refunds_deduction_category
  ON payment_refunds(deduction_category)
  WHERE deduction_category IS NOT NULL;

CREATE INDEX idx_payment_refunds_deposit_history
ON payment_refunds(order_id, payment_id, status, created_at);

CREATE INDEX idx_payment_refunds_pending_bank_transfer
ON payment_refunds(created_at)
WHERE status = 'pending' AND refund_method = 'bank_transfer' AND admin_notified_at IS NULL;

CREATE TRIGGER payment_refunds_to_allocations
AFTER INSERT ON payment_refunds WHEN NEW.status = 'succeeded' BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;

CREATE TRIGGER deposit_refunds_cannot_exceed_paid_deposit
BEFORE INSERT ON payment_refunds
WHEN NEW.type = 'deposit' AND NEW.status = 'succeeded'
BEGIN
  SELECT RAISE(ABORT, 'deposit refund exceeds remaining refundable amount')
  WHERE NEW.refund_amount > (
    COALESCE((SELECT deposit_amount FROM payments WHERE id = NEW.payment_id), 0) -
    COALESCE((SELECT SUM(refund_amount) FROM payment_refunds
      WHERE payment_id = NEW.payment_id AND type = 'deposit' AND status = 'succeeded'), 0)
  );
END;

CREATE TRIGGER payment_refund_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status = 'pending'
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;

CREATE TRIGGER payment_refund_any_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status <> 'succeeded' AND NEW.payment_id IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;
