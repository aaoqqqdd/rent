-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_early_return_once
ON payment_refunds(order_id, type)
WHERE type = 'early_return' AND status IN ('pending', 'succeeded');
