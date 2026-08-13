-- Repair older remote databases where the login history migration was skipped.
CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  account TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_history_user
  ON login_history(user_id, created_at DESC);
