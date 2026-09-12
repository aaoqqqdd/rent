-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 一个客户对应一个 Stripe Customer，跨订单复用其姓名、邮箱、电话和支付方式。
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
