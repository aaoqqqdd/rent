CREATE TABLE IF NOT EXISTS deposit_settlements (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  deposit_amount REAL NOT NULL,
  refund_amount REAL NOT NULL,
  deduction_amount REAL NOT NULL DEFAULT 0,
  deduction_category TEXT,
  deduction_reason TEXT,
  refund_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_MANAGER_APPROVAL' CHECK(status IN ('PENDING_MANAGER_APPROVAL','APPROVED','REJECTED','EXECUTED','CANCELLED')),
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  executed_by TEXT,
  executed_at TEXT,
  settlement_number TEXT NOT NULL UNIQUE,
  document_snapshot TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_deposit_settlements_status ON deposit_settlements(status, requested_at DESC);
