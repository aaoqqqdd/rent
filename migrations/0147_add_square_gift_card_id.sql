-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE orders ADD COLUMN square_gift_card_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_square_gift_card_id ON orders(square_gift_card_id);
