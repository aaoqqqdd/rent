-- 押金与租金支付渠道分离：押金可银行转账、现金或信用卡预授权。
ALTER TABLE orders ADD COLUMN deposit_method TEXT NOT NULL DEFAULT 'card_hold'
  CHECK(deposit_method IN ('bank_transfer', 'cash', 'card_hold'));
