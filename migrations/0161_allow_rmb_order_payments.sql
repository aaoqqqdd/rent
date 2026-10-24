-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 允许支付宝、微信订单及付款记录；完整保留既有数据、索引与触发器。
PRAGMA defer_foreign_keys = ON;

-- 暂时移除跨表触发器，避免重命名时解析尚未恢复的表。
DROP TRIGGER refund_allocations_cannot_exceed_payment;
DROP TRIGGER deposit_refunds_cannot_exceed_paid_deposit;

CREATE TABLE orders_rmb_new (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT,
  deviceId TEXT NOT NULL,
  startDate TEXT,
  endDate TEXT,
  rentalPeriod INTEGER NOT NULL,
  totalAmount REAL NOT NULL,
  depositAmount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_approval', 'approved', 'pending_payment', 'awaiting_signature', 'paid', 'pending_pickup', 'active', 'extended', 'overdue', 'suspended', 'pending_return', 'returned', 'completed', 'cancelled')),
  paymentMethod TEXT CHECK(paymentMethod IN ('card', 'bank_transfer', 'balance', 'alipay', 'wechat')),
  contractSigned BOOLEAN NOT NULL DEFAULT 0,
  referrerId TEXT,
  commissionRate REAL,
  commissionAmount REAL,
  squarePaymentId TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orderNo TEXT,
  createdAtBy TEXT,
  contractId TEXT,
  refundMethod TEXT NOT NULL DEFAULT 'balance' CHECK(refundMethod IN ('balance', 'original')),
  refundBsb TEXT,
  refundAccountNumber TEXT,
  refundAccountName TEXT,
  startPeriod TEXT NOT NULL DEFAULT 'AM' CHECK(startPeriod IN ('AM', 'PM')),
  endPeriod TEXT NOT NULL DEFAULT 'AM' CHECK(endPeriod IN ('AM', 'PM')),
  pickupTimeSlot TEXT,
  returnTimeSlot TEXT,
  pickupLocation TEXT,
  returnLocation TEXT,
  deliveryMethod TEXT NOT NULL DEFAULT 'Pickup',
  deliveryFee REAL NOT NULL DEFAULT 0,
  rentalNote TEXT,
  coupon_code TEXT,
  discount_amount REAL NOT NULL DEFAULT 0,
  serviceFee REAL NOT NULL DEFAULT 0,
  order_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  rental_status TEXT NOT NULL DEFAULT 'PENDING',
  amount_due REAL NOT NULL DEFAULT 0,
  handover_completed_at TEXT,
  handover_by TEXT,
  return_received_at TEXT,
  return_received_by TEXT,
  handover_overdue INTEGER NOT NULL DEFAULT 0,
  possible_handover INTEGER NOT NULL DEFAULT 0,
  early_return_requested_at TEXT,
  early_return_requested_by TEXT,
  early_return_approved_at TEXT,
  early_return_approved_by TEXT,
  deposit_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED' CHECK(deposit_status IN ('NOT_REQUIRED', 'PENDING', 'PAID', 'HELD', 'PARTIALLY_DEDUCTED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FORFEITED')),
  deposit_paid_at TEXT,
  deposit_held_amount REAL NOT NULL DEFAULT 0,
  deposit_deduction_amount REAL NOT NULL DEFAULT 0,
  deposit_refund_amount REAL NOT NULL DEFAULT 0,
  deposit_refund_at TEXT,
  coupon_id TEXT,
  coupon_snapshot TEXT,
  stripe_payment_method_id TEXT,
  stripe_setup_intent_id TEXT,
  deposit_payment_mode TEXT NOT NULL DEFAULT 'PAID'
  CHECK(deposit_payment_mode IN ('PAID', 'PREAUTH', 'SETUP_INTENT')),
  stripe_deposit_payment_intent_id TEXT,
  deposit_method TEXT NOT NULL DEFAULT 'card_hold'
  CHECK(deposit_method IN ('bank_transfer', 'cash', 'card_hold')),
  payment_provider TEXT,
  square_gift_card_id TEXT,
  settlement_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
  CHECK(settlement_status IN ('NOT_APPLICABLE', 'PENDING', 'SETTLED')),
  overdue_charge_total REAL NOT NULL DEFAULT 0,
  overdue_deposit_applied REAL NOT NULL DEFAULT 0,
  overdue_outstanding_amount REAL NOT NULL DEFAULT 0,
  is_manual INTEGER NOT NULL DEFAULT 0 CHECK(is_manual IN (0, 1)), rental_link_id TEXT REFERENCES rental_links(id), booking_buffer_days INTEGER NOT NULL DEFAULT 0 CHECK(booking_buffer_days >= 0),
  CHECK(is_manual = 1 OR (userId IS NOT NULL AND startDate IS NOT NULL AND endDate IS NOT NULL)),
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (deviceId) REFERENCES devices(id),
  FOREIGN KEY (referrerId) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO orders_rmb_new (id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, status, paymentMethod, contractSigned, referrerId, commissionRate, commissionAmount, squarePaymentId, createdAt, updatedAt, orderNo, createdAtBy, contractId, refundMethod, refundBsb, refundAccountNumber, refundAccountName, startPeriod, endPeriod, pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod, deliveryFee, rentalNote, coupon_code, discount_amount, serviceFee, order_status, payment_status, rental_status, amount_due, handover_completed_at, handover_by, return_received_at, return_received_by, handover_overdue, possible_handover, early_return_requested_at, early_return_requested_by, early_return_approved_at, early_return_approved_by, deposit_status, deposit_paid_at, deposit_held_amount, deposit_deduction_amount, deposit_refund_amount, deposit_refund_at, coupon_id, coupon_snapshot, stripe_payment_method_id, stripe_setup_intent_id, deposit_payment_mode, stripe_deposit_payment_intent_id, deposit_method, payment_provider, square_gift_card_id, settlement_status, overdue_charge_total, overdue_deposit_applied, overdue_outstanding_amount, is_manual, rental_link_id, booking_buffer_days)
SELECT id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, status, paymentMethod, contractSigned, referrerId, commissionRate, commissionAmount, squarePaymentId, createdAt, updatedAt, orderNo, createdAtBy, contractId, refundMethod, refundBsb, refundAccountNumber, refundAccountName, startPeriod, endPeriod, pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod, deliveryFee, rentalNote, coupon_code, discount_amount, serviceFee, order_status, payment_status, rental_status, amount_due, handover_completed_at, handover_by, return_received_at, return_received_by, handover_overdue, possible_handover, early_return_requested_at, early_return_requested_by, early_return_approved_at, early_return_approved_by, deposit_status, deposit_paid_at, deposit_held_amount, deposit_deduction_amount, deposit_refund_amount, deposit_refund_at, coupon_id, coupon_snapshot, stripe_payment_method_id, stripe_setup_intent_id, deposit_payment_mode, stripe_deposit_payment_intent_id, deposit_method, payment_provider, square_gift_card_id, settlement_status, overdue_charge_total, overdue_deposit_applied, overdue_outstanding_amount, is_manual, rental_link_id, booking_buffer_days FROM orders;

DROP TABLE orders;
ALTER TABLE orders_rmb_new RENAME TO orders;

CREATE INDEX idx_orders_order_status ON orders(order_status);

CREATE INDEX idx_orders_payment_status ON orders(payment_status);

CREATE INDEX idx_orders_rental_status ON orders(rental_status);

CREATE INDEX idx_orders_deposit_status ON orders(deposit_status);

CREATE TRIGGER update_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  UPDATE orders SET updatedAt = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE UNIQUE INDEX idx_orders_stripe_deposit_payment_intent
ON orders(stripe_deposit_payment_intent_id)
WHERE stripe_deposit_payment_intent_id IS NOT NULL;

CREATE INDEX idx_orders_userid ON orders(userId);

CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_orders_deviceid ON orders(deviceId);

CREATE INDEX idx_orders_start_date ON orders(startDate);

CREATE INDEX idx_orders_end_date ON orders(endDate);

CREATE INDEX idx_orders_created_at ON orders(createdAt DESC);

CREATE INDEX idx_orders_order_no_upper ON orders(UPPER(orderNo));

CREATE INDEX idx_orders_square_gift_card_id ON orders(square_gift_card_id);

CREATE INDEX idx_orders_settlement_status ON orders(settlement_status);

CREATE INDEX idx_orders_rental_link ON orders(rental_link_id);

CREATE TRIGGER rental_link_booking_insert
BEFORE INSERT ON orders
WHEN NEW.status NOT IN ('completed', 'cancelled') AND EXISTS (
    SELECT 1 FROM orders old
    WHERE old.id != NEW.id AND old.deviceId = NEW.deviceId
      AND old.status NOT IN ('completed', 'cancelled')
      AND (NEW.rental_link_id IS NOT NULL OR old.rental_link_id IS NOT NULL)
      AND (NEW.startDate IS NULL OR NEW.endDate IS NULL OR old.startDate IS NULL OR old.endDate IS NULL OR (
        julianday(NEW.startDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 THEN 0 WHEN NEW.startPeriod = 'PM' THEN 1 ELSE 0 END - MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
          < julianday(old.endDate) * 2 + CASE WHEN old.endPeriod = 'PM' THEN 1 ELSE 0 END
        AND julianday(old.startDate) * 2 + CASE WHEN old.startPeriod = 'PM' THEN 1 ELSE 0 END
          < julianday(NEW.endDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 OR NEW.endPeriod = 'PM' THEN 1 ELSE 0 END + MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
      ))
  )
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_BOOKING_CONFLICT');
END;

CREATE TRIGGER rental_link_booking_update
BEFORE UPDATE OF deviceId, startDate, endDate, startPeriod, endPeriod, status ON orders
WHEN NEW.status NOT IN ('completed', 'cancelled') AND EXISTS (
    SELECT 1 FROM orders old
    WHERE old.id != NEW.id AND old.deviceId = NEW.deviceId
      AND old.status NOT IN ('completed', 'cancelled')
      AND (NEW.rental_link_id IS NOT NULL OR old.rental_link_id IS NOT NULL)
      AND (NEW.startDate IS NULL OR NEW.endDate IS NULL OR old.startDate IS NULL OR old.endDate IS NULL OR (
        julianday(NEW.startDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 THEN 0 WHEN NEW.startPeriod = 'PM' THEN 1 ELSE 0 END - MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
          < julianday(old.endDate) * 2 + CASE WHEN old.endPeriod = 'PM' THEN 1 ELSE 0 END
        AND julianday(old.startDate) * 2 + CASE WHEN old.startPeriod = 'PM' THEN 1 ELSE 0 END
          < julianday(NEW.endDate) * 2 + CASE WHEN MAX(NEW.booking_buffer_days, old.booking_buffer_days) > 0 OR NEW.endPeriod = 'PM' THEN 1 ELSE 0 END + MAX(NEW.booking_buffer_days, old.booking_buffer_days) * 2
      ))
  )
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_BOOKING_CONFLICT');
END;

CREATE TRIGGER rental_link_enabled_insert
BEFORE INSERT ON orders
WHEN NEW.rental_link_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM rental_links l JOIN devices d ON d.id = l.device_id JOIN users u ON u.id = l.created_by
  WHERE l.id = NEW.rental_link_id AND l.device_id = NEW.deviceId AND l.enabled = 1
    AND d.status NOT IN ('maintenance', 'retired') AND u.role = 'ADMIN' AND u.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'RENTAL_LINK_UNAVAILABLE');
END;

CREATE TABLE payments_rmb_new (
  id TEXT PRIMARY KEY NOT NULL,
  rental_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'bank_transfer', 'balance', 'alipay', 'wechat')),
  amount REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  rental_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'refunded')),
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  processing_fee REAL NOT NULL DEFAULT 0
, payment_provider TEXT, square_payment_id TEXT, square_paid_amount REAL NOT NULL DEFAULT 0);

INSERT INTO payments_rmb_new (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, transaction_id, paid_at, created_at, updated_at, stripe_checkout_session_id, stripe_payment_intent_id, processing_fee, payment_provider, square_payment_id, square_paid_amount)
SELECT id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, transaction_id, paid_at, created_at, updated_at, stripe_checkout_session_id, stripe_payment_intent_id, processing_fee, payment_provider, square_payment_id, square_paid_amount FROM payments;

DROP TABLE payments;
ALTER TABLE payments_rmb_new RENAME TO payments;

CREATE UNIQUE INDEX idx_payments_stripe_checkout_session
ON payments(stripe_checkout_session_id)
WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX idx_payments_stripe_payment_intent
ON payments(stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TRIGGER update_payments_updated_at
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
  UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER payments_to_allocations
AFTER INSERT ON payments BEGIN
  INSERT INTO payment_allocations (id, payment_id, order_id, allocation_type, amount)
  SELECT 'pa-' || lower(hex(randomblob(16))), NEW.id, NEW.rental_id, 'RENTAL', NEW.rental_amount
  WHERE NEW.rental_amount <> 0;
  INSERT INTO payment_allocations (id, payment_id, order_id, allocation_type, amount)
  SELECT 'pa-' || lower(hex(randomblob(16))), NEW.id, NEW.rental_id, 'DEPOSIT', NEW.deposit_amount
  WHERE NEW.deposit_amount <> 0;
END;

CREATE UNIQUE INDEX idx_payments_square_payment_id
  ON payments(square_payment_id)
  WHERE square_payment_id IS NOT NULL;

CREATE INDEX idx_payments_provider
  ON payments(payment_provider, rental_id, status);

CREATE TRIGGER refund_allocations_cannot_exceed_payment
BEFORE INSERT ON refund_allocations BEGIN
  SELECT RAISE(ABORT, 'refund allocation exceeds paid amount')
  WHERE NEW.amount > (
    COALESCE((SELECT amount FROM payments WHERE id = NEW.payment_id), 0) -
    COALESCE((SELECT SUM(amount) FROM refund_allocations WHERE payment_id = NEW.payment_id), 0)
  );
END;

CREATE TRIGGER deposit_refunds_cannot_exceed_paid_deposit
BEFORE INSERT ON payment_refunds
WHEN NEW.type = 'deposit' AND NEW.status = 'succeeded'
BEGIN
  SELECT RAISE(ABORT, 'deposit refund exceeds remaining refundable amount')
  WHERE NEW.refund_amount > (
    COALESCE((SELECT deposit_amount FROM payments WHERE id = NEW.payment_id), 0) -
    COALESCE((SELECT SUM(refund_amount) FROM payment_refunds
      WHERE payment_id = NEW.payment_id AND type = 'deposit' AND status = 'succeeded'), 0)
  );
END;

PRAGMA defer_foreign_keys = OFF;
