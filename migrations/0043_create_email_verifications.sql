CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_sent
  ON email_verifications(user_id, sent_at);
