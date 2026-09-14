-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Square 礼品卡充值需要作为独立 payment_method 落库；SQLite 的 CHECK
-- 约束不能直接修改，因此重建余额充值表并保留现有数据及 Stripe 索引。
ALTER TABLE balance_topups RENAME TO balance_topups_legacy;

CREATE TABLE balance_topups (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  processing_fee REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'square', 'bank_transfer', 'alipay', 'wechat')),
  cny_amount REAL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'awaiting_transfer', 'submitted', 'paid', 'failed', 'rejected')),
  reference TEXT,
  note TEXT,
  proof_image_url TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO balance_topups (
  id, user_id, amount, processing_fee, payment_method, cny_amount, status,
  reference, note, proof_image_url, stripe_checkout_session_id,
  stripe_payment_intent_id, transaction_id, paid_at, created_at, updated_at
)
SELECT
  id, user_id, amount, processing_fee, payment_method, cny_amount, status,
  reference, note, proof_image_url, stripe_checkout_session_id,
  stripe_payment_intent_id, transaction_id, paid_at, created_at, updated_at
FROM balance_topups_legacy;

DROP TABLE balance_topups_legacy;

CREATE INDEX IF NOT EXISTS idx_balance_topups_user
  ON balance_topups(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_topups_stripe_payment_intent
  ON balance_topups(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
