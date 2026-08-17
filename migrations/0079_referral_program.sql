-- Customer referral program. These tables intentionally do not reuse legacy commission records.
CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY NOT NULL, customer_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, disabled_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_customer_active ON referral_codes(customer_id) WHERE status = 'ACTIVE';
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY NOT NULL, referral_number TEXT NOT NULL UNIQUE,
  referrer_customer_id TEXT NOT NULL, referee_customer_id TEXT NOT NULL UNIQUE, referral_code_id TEXT,
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK(status IN ('PENDING','REGISTERED','QUALIFYING','QUALIFIED','REWARDED','INVALID','CANCELLED')),
  attributed_at TEXT, registered_at TEXT, qualifying_order_id TEXT, qualified_at TEXT, rewarded_at TEXT,
  invalidated_at TEXT, invalid_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(referrer_customer_id <> referee_customer_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_customer_id);
CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY NOT NULL, reward_number TEXT NOT NULL UNIQUE, referral_id TEXT NOT NULL,
  customer_id TEXT NOT NULL, order_id TEXT, reward_type TEXT NOT NULL DEFAULT 'ACCOUNT_BALANCE',
  reward_amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','AVAILABLE','CANCELLED','REVERSED')),
  available_at TEXT, issued_at TEXT, cancelled_at TEXT, balance_transaction_id TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_customer ON referral_rewards(customer_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS referral_audit_logs (
  id TEXT PRIMARY KEY NOT NULL, referral_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT,
  reason TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
