-- 推荐奖励账本整合。
-- 历史上"佣金"用 commission_records（pending/settled/withdrawn），后来推荐流程改成
-- referral_rewards（PENDING/APPROVED/AVAILABLE/CANCELLED/REVERSED）+ users.commission_balance。
-- 但迁移只做了一半：新流程只写 referral_rewards，commission_records 再无写入方，
-- 而 /customer/referral 页面和 createWithdrawalRequest 的提现资格校验仍只读
-- commission_records —— 结果是客户推荐页归零、通过新流程赚到的佣金完全无法提现。
-- 本迁移把 referral_rewards 定为唯一赚取账本，commission_withdrawals 继续做提现队列。

-- 提现消耗标记：被某次提现划走的奖励打上时间戳与提现单号，可提现额 = 未被划走的
-- AVAILABLE 奖励合计（应与 users.commission_balance 一致）。
ALTER TABLE referral_rewards ADD COLUMN withdrawn_at TEXT;
ALTER TABLE referral_rewards ADD COLUMN withdrawal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_referral_rewards_withdrawable
  ON referral_rewards(customer_id, status, withdrawn_at);

-- 回填历史 commission_records（生产库可能有数据），保证既有佣金余额继续可提现。
-- referral_id 用占位串（D1 不强制外键）。referrer_id 即推荐人 = referral_rewards.customer_id。
INSERT INTO referral_rewards (
  id, reward_number, referral_id, customer_id, order_id, reward_type,
  reward_amount, currency, status, available_at, withdrawn_at, reason, created_at, updated_at
)
SELECT
  'rrw-lgc-' || cr.id,
  'RRW-LGC-' || substr(replace(cr.id, '-', ''), 1, 24),
  'legacy-' || cr.id,
  cr.referrer_id,
  cr.rental_id,
  'ACCOUNT_BALANCE',
  cr.amount,
  'AUD',
  CASE cr.status WHEN 'pending' THEN 'PENDING' ELSE 'AVAILABLE' END,
  CASE WHEN cr.status IN ('settled', 'withdrawn') THEN COALESCE(cr.settled_at, cr.created_at) END,
  CASE WHEN cr.status = 'withdrawn' THEN COALESCE(cr.settled_at, cr.created_at) END,
  '历史佣金记录迁移',
  cr.created_at,
  CURRENT_TIMESTAMP
FROM commission_records cr
WHERE NOT EXISTS (
  SELECT 1 FROM referral_rewards rr
  WHERE rr.customer_id = cr.referrer_id AND rr.order_id = cr.rental_id
);

DROP TABLE commission_records;
