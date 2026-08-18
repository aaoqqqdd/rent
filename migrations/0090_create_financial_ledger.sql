-- Immutable accounting events. Source keys make retries idempotent while
-- preserving the original payment/refund/balance domain records.
CREATE TABLE IF NOT EXISTS financial_ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  entry_number TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('PAYMENT','REFUND','BALANCE','REFERRAL_REWARD','COUPON_DISCOUNT')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  customer_id TEXT,
  order_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_customer ON financial_ledger_entries(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_order ON financial_ledger_entries(order_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS financial_ledger_entries_no_update
BEFORE UPDATE ON financial_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'financial ledger entries are immutable');
END;
CREATE TRIGGER IF NOT EXISTS financial_ledger_entries_no_delete
BEFORE DELETE ON financial_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'financial ledger entries are immutable');
END;

-- Existing balance writers are intentionally retained; every append to their
-- ledger is mirrored here so no balance mutation path can skip accounting.
CREATE TRIGGER IF NOT EXISTS balance_transactions_to_financial_ledger
AFTER INSERT ON balance_transactions BEGIN
  INSERT OR IGNORE INTO financial_ledger_entries (
    id, entry_number, entry_type, amount, customer_id, source_type, source_id,
    description, metadata, created_by
  ) VALUES (
    'fle-' || lower(hex(randomblob(16))), 'FLE-' || upper(hex(randomblob(6))),
    'BALANCE', NEW.amount, NEW.user_id, 'BALANCE_TRANSACTION', NEW.id,
    NEW.reason, json_object('type', NEW.type, 'balanceAfter', NEW.balance_after), NEW.created_by
  );
END;
