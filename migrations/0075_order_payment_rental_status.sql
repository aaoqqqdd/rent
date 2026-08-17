-- Separate order, payment and rental lifecycle state without removing the
-- legacy status column. The legacy column remains during the compatibility
-- period because older routes and clients still read it.
ALTER TABLE orders ADD COLUMN order_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE orders ADD COLUMN rental_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN amount_due REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN handover_completed_at TEXT;
ALTER TABLE orders ADD COLUMN handover_by TEXT;
ALTER TABLE orders ADD COLUMN return_received_at TEXT;
ALTER TABLE orders ADD COLUMN return_received_by TEXT;
ALTER TABLE orders ADD COLUMN handover_overdue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN possible_handover INTEGER NOT NULL DEFAULT 0;

UPDATE orders
SET
  order_status = CASE status
    WHEN 'pending_approval' THEN 'PENDING'
    WHEN 'approved' THEN 'AWAITING_PAYMENT'
    WHEN 'pending_payment' THEN 'AWAITING_PAYMENT'
    WHEN 'paid' THEN 'CONFIRMED'
    WHEN 'pending_pickup' THEN 'READY_FOR_PICKUP'
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'pending_return' THEN 'RETURN_PENDING'
    WHEN 'completed' THEN 'COMPLETED'
    WHEN 'cancelled' THEN 'CANCELLED'
    ELSE 'PENDING'
  END,
  payment_status = CASE
    WHEN status IN ('paid', 'active', 'pending_pickup', 'pending_return', 'completed') THEN 'PAID'
    WHEN status = 'cancelled' AND totalAmount > 0 THEN 'PAYMENT_FAILED'
    ELSE 'UNPAID'
  END,
  rental_status = CASE status
    WHEN 'pending_payment' THEN 'PENDING'
    WHEN 'pending_approval' THEN 'PENDING'
    WHEN 'approved' THEN 'AWAITING_PAYMENT'
    WHEN 'paid' THEN 'CONFIRMED'
    WHEN 'pending_pickup' THEN 'READY_FOR_PICKUP'
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'pending_return' THEN 'RETURN_PENDING'
    WHEN 'completed' THEN 'COMPLETED'
    WHEN 'cancelled' THEN 'CANCELLED'
    ELSE 'PENDING'
  END;

CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_rental_status ON orders(rental_status);

CREATE TABLE IF NOT EXISTS rental_status_history (
  id TEXT PRIMARY KEY NOT NULL,
  rental_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'SYSTEM',
  triggered_by TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rental_status_history_rental ON rental_status_history(rental_id, created_at DESC);
