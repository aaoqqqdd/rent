-- A referral becomes a financial event only when it is actually issued, not
-- while it is merely pending eligibility review.
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
