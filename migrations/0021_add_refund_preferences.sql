ALTER TABLE orders ADD COLUMN refundMethod TEXT NOT NULL DEFAULT 'balance' CHECK(refundMethod IN ('balance', 'original'));
ALTER TABLE orders ADD COLUMN refundBsb TEXT;
ALTER TABLE orders ADD COLUMN refundAccountNumber TEXT;
ALTER TABLE orders ADD COLUMN refundAccountName TEXT;

ALTER TABLE payment_refunds ADD COLUMN refund_method TEXT NOT NULL DEFAULT 'balance' CHECK(refund_method IN ('balance', 'stripe', 'bank_transfer'));
ALTER TABLE payment_refunds ADD COLUMN refund_bsb TEXT;
ALTER TABLE payment_refunds ADD COLUMN refund_account_number TEXT;
ALTER TABLE payment_refunds ADD COLUMN refund_account_name TEXT;
