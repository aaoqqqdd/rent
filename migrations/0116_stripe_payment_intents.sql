-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 站内 Stripe Payment Element：付款对象从 Checkout Session 换成 PaymentIntent。
-- payments.stripe_payment_intent_id 已在 0020 建列；这里补唯一索引用于 webhook 幂等匹配。
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent
ON payments(stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

-- 余额充值同样改用 PaymentIntent，需要一列存 PI id。
ALTER TABLE balance_topups ADD COLUMN stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_topups_stripe_payment_intent
ON balance_topups(stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;
