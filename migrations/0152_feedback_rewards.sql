-- Tally customer feedback reward records and preloaded external gift-card codes.
CREATE TABLE IF NOT EXISTS feedback_rewards (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  response_id TEXT,
  form_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK(reward_type IN ('BALANCE','COUPON','GIFT_CARD')),
  reward_amount REAL,
  coupon_id TEXT,
  gift_card_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','ISSUED','FAILED','SKIPPED')),
  reward_data TEXT NOT NULL DEFAULT '{}',
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, form_id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_rewards_customer ON feedback_rewards(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_gift_cards (
  id TEXT PRIMARY KEY NOT NULL,
  brand TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  amount REAL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','ISSUED','VOID')),
  feedback_reward_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_gift_cards_status ON feedback_gift_cards(status, created_at);
