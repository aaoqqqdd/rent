-- 高风险推荐奖励不自动结算，先进入管理员审核队列。
-- referral_rewards 原表有 status CHECK，SQLite 不能直接修改 CHECK，因此重建并保留现有奖励及提现字段。
CREATE TABLE referral_rewards_risk_review (
  id TEXT PRIMARY KEY NOT NULL, reward_number TEXT NOT NULL UNIQUE, referral_id TEXT NOT NULL,
  customer_id TEXT NOT NULL, order_id TEXT, reward_type TEXT NOT NULL DEFAULT 'ACCOUNT_BALANCE',
  reward_amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PENDING_REVIEW','APPROVED','AVAILABLE','CANCELLED','REVERSED')),
  available_at TEXT, issued_at TEXT, cancelled_at TEXT, balance_transaction_id TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TEXT, withdrawal_id TEXT
);

INSERT INTO referral_rewards_risk_review (
  id, reward_number, referral_id, customer_id, order_id, reward_type, reward_amount, currency,
  status, available_at, issued_at, cancelled_at, balance_transaction_id, reason, created_at,
  updated_at, withdrawn_at, withdrawal_id
)
SELECT
  id, reward_number, referral_id, customer_id, order_id, reward_type, reward_amount, currency,
  status, available_at, issued_at, cancelled_at, balance_transaction_id, reason, created_at,
  updated_at, withdrawn_at, withdrawal_id
FROM referral_rewards;

DROP TABLE referral_rewards;
ALTER TABLE referral_rewards_risk_review RENAME TO referral_rewards;
CREATE INDEX IF NOT EXISTS idx_referral_rewards_customer ON referral_rewards(customer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_withdrawable ON referral_rewards(customer_id, status, withdrawn_at);

-- 重建表会移除旧表上的触发器，保留原有财务台账兼容逻辑。
CREATE TRIGGER IF NOT EXISTS referral_rewards_to_financial_ledger
AFTER UPDATE OF status ON referral_rewards
WHEN NEW.status = 'ISSUED' AND NEW.reward_amount <> 0 BEGIN
  INSERT OR IGNORE INTO financial_ledger_entries (
    id, entry_number, entry_type, amount, customer_id, order_id, source_type,
    source_id, description, metadata
  ) VALUES (
    'fle-' || lower(hex(randomblob(16))), 'FLE-' || upper(hex(randomblob(6))),
    'REFERRAL_REWARD', NEW.reward_amount, NEW.customer_id, NEW.order_id,
    'REFERRAL_REWARD', NEW.id, COALESCE(NEW.reason, '推荐奖励'),
    json_object('rewardNumber', NEW.reward_number)
  );
END;
