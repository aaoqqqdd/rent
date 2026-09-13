-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 余额支付订单涨价后，外部补款成功时只允许冲销一次负余额。
ALTER TABLE order_price_adjustments ADD COLUMN balance_offset_applied INTEGER NOT NULL DEFAULT 0;
