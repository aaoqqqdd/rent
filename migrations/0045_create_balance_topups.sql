CREATE TABLE IF NOT EXISTS balance_topups (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  processing_fee REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'bank_transfer')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'awaiting_transfer', 'submitted', 'paid', 'failed', 'rejected')),
  reference TEXT,
  note TEXT,
  stripe_checkout_session_id TEXT,
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_balance_topups_user ON balance_topups(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  account TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
