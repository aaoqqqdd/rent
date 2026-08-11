CREATE TABLE IF NOT EXISTS balance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user ON balance_transactions(user_id, created_at DESC);
