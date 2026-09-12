-- 押金与租金拆分支付：短期押金预授权，长期只保存支付方式。
ALTER TABLE orders ADD COLUMN deposit_payment_mode TEXT NOT NULL DEFAULT 'PAID'
  CHECK(deposit_payment_mode IN ('PAID', 'PREAUTH', 'SETUP_INTENT'));
ALTER TABLE orders ADD COLUMN stripe_deposit_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_deposit_payment_intent
ON orders(stripe_deposit_payment_intent_id)
WHERE stripe_deposit_payment_intent_id IS NOT NULL;
