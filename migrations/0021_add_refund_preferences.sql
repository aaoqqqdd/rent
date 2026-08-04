-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE orders ADD COLUMN refundMethod TEXT NOT NULL DEFAULT 'balance' CHECK(refundMethod IN ('balance', 'original'));
ALTER TABLE orders ADD COLUMN refundBsb TEXT;
ALTER TABLE orders ADD COLUMN refundAccountNumber TEXT;
ALTER TABLE orders ADD COLUMN refundAccountName TEXT;

ALTER TABLE payment_refunds ADD COLUMN refund_method TEXT NOT NULL DEFAULT 'balance' CHECK(refund_method IN ('balance', 'stripe', 'bank_transfer'));
ALTER TABLE payment_refunds ADD COLUMN refund_bsb TEXT;
ALTER TABLE payment_refunds ADD COLUMN refund_account_number TEXT;
ALTER TABLE payment_refunds ADD COLUMN refund_account_name TEXT;
