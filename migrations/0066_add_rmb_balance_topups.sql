ALTER TABLE balance_topups RENAME TO balance_topups_legacy;
CREATE TABLE balance_topups (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  processing_fee REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'bank_transfer', 'alipay', 'wechat')),
  cny_amount REAL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'awaiting_transfer', 'submitted', 'paid', 'failed', 'rejected')),
  reference TEXT,
  note TEXT,
  proof_image_url TEXT,
  stripe_checkout_session_id TEXT,
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO balance_topups (id, user_id, amount, processing_fee, payment_method, status, reference, note, stripe_checkout_session_id, transaction_id, paid_at, created_at, updated_at)
SELECT id, user_id, amount, processing_fee, payment_method, status, reference, note, stripe_checkout_session_id, transaction_id, paid_at, created_at, updated_at FROM balance_topups_legacy;
DROP TABLE balance_topups_legacy;
CREATE INDEX IF NOT EXISTS idx_balance_topups_user ON balance_topups(user_id, created_at DESC);
