-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Square is a provider layered on top of the existing card payment method.
-- Keeping paymentMethod='card' preserves the historical SQLite CHECK constraint;
-- payment_provider identifies whether that card was processed by Stripe or Square.
ALTER TABLE users ADD COLUMN square_customer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_square_customer_id
  ON users(square_customer_id)
  WHERE square_customer_id IS NOT NULL;

ALTER TABLE devices ADD COLUMN square_catalog_object_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_square_catalog_object_id
  ON devices(square_catalog_object_id)
  WHERE square_catalog_object_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN payment_provider TEXT;
ALTER TABLE payments ADD COLUMN payment_provider TEXT;
ALTER TABLE payments ADD COLUMN square_payment_id TEXT;

UPDATE orders
SET payment_provider = CASE WHEN paymentMethod = 'card' THEN 'stripe' ELSE 'internal' END
WHERE payment_provider IS NULL;

UPDATE payments
SET payment_provider = CASE WHEN payment_method = 'card' THEN 'stripe' ELSE 'internal' END
WHERE payment_provider IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_square_payment_id
  ON payments(square_payment_id)
  WHERE square_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_provider
  ON payments(payment_provider, rental_id, status);
