ALTER TABLE coupons ADD COLUMN max_discount_amount REAL;
ALTER TABLE coupons ADD COLUMN minimum_order_amount REAL;
ALTER TABLE coupons ADD COLUMN max_uses_per_customer INTEGER;
ALTER TABLE coupons ADD COLUMN new_customer_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN stackable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN restore_on_cancellation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE coupons ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('DRAFT','ACTIVE','DISABLED','EXPIRED'));
ALTER TABLE coupons ADD COLUMN updated_by TEXT;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  coupon_id TEXT NOT NULL,
  coupon_code TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  discount_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL CHECK(status IN ('RESERVED','REDEEMED','RELEASED','REVERSED')),
  redeemed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_customer ON coupon_redemptions(coupon_id, customer_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);

ALTER TABLE orders ADD COLUMN coupon_id TEXT;
ALTER TABLE orders ADD COLUMN coupon_snapshot TEXT;
