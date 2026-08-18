ALTER TABLE orders ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
  CHECK(deposit_status IN ('NOT_REQUIRED', 'PENDING', 'PAID', 'HELD', 'PARTIALLY_DEDUCTED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FORFEITED'));
ALTER TABLE orders ADD COLUMN deposit_paid_at TEXT;
ALTER TABLE orders ADD COLUMN deposit_held_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN deposit_deduction_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN deposit_refund_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN deposit_refund_at TEXT;

UPDATE orders
SET deposit_status = CASE WHEN COALESCE(depositAmount, 0) > 0 THEN 'PENDING' ELSE 'NOT_REQUIRED' END,
    deposit_held_amount = COALESCE(depositAmount, 0)
WHERE deposit_status = 'NOT_REQUIRED';

CREATE INDEX IF NOT EXISTS idx_orders_deposit_status ON orders(deposit_status);
