-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- The original orders table inherited a legacy CHECK constraint from rentals.
-- Rebuild it so the order lifecycle states used by the application are valid.
PRAGMA foreign_keys = OFF;

CREATE TABLE orders_new (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  deviceId TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  rentalPeriod INTEGER NOT NULL,
  totalAmount REAL NOT NULL,
  depositAmount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_approval', 'approved', 'pending_payment', 'awaiting_signature', 'paid', 'pending_pickup', 'active', 'extended', 'overdue', 'suspended', 'pending_return', 'returned', 'completed', 'cancelled')),
  paymentMethod TEXT CHECK(paymentMethod IN ('card', 'bank_transfer', 'balance')),
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
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (deviceId) REFERENCES devices(id),
  FOREIGN KEY (referrerId) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO orders_new (
  id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount,
  status, paymentMethod, contractSigned, referrerId, commissionRate, commissionAmount,
  squarePaymentId, createdAt, updatedAt, orderNo, createdAtBy, contractId, refundMethod,
  refundBsb, refundAccountNumber, refundAccountName, startPeriod, endPeriod,
  pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod,
  deliveryFee, rentalNote, coupon_code, discount_amount, serviceFee, order_status,
  payment_status, rental_status, amount_due, handover_completed_at, handover_by,
  return_received_at, return_received_by, handover_overdue, possible_handover,
  early_return_requested_at, early_return_requested_by, early_return_approved_at,
  early_return_approved_by, deposit_status, deposit_paid_at, deposit_held_amount,
  deposit_deduction_amount, deposit_refund_amount, deposit_refund_at, coupon_id,
  coupon_snapshot, stripe_payment_method_id, stripe_setup_intent_id
)
SELECT
  id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount,
  status, paymentMethod, contractSigned, referrerId, commissionRate, commissionAmount,
  squarePaymentId, createdAt, updatedAt, orderNo, createdAtBy, contractId, refundMethod,
  refundBsb, refundAccountNumber, refundAccountName, startPeriod, endPeriod,
  pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod,
  deliveryFee, rentalNote, coupon_code, discount_amount, serviceFee, order_status,
  payment_status, rental_status, amount_due, handover_completed_at, handover_by,
  return_received_at, return_received_by, handover_overdue, possible_handover,
  early_return_requested_at, early_return_requested_by, early_return_approved_at,
  early_return_approved_by, deposit_status, deposit_paid_at, deposit_held_amount,
  deposit_deduction_amount, deposit_refund_amount, deposit_refund_at, coupon_id,
  coupon_snapshot, stripe_payment_method_id, stripe_setup_intent_id
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_rental_status ON orders(rental_status);
CREATE INDEX IF NOT EXISTS idx_orders_deposit_status ON orders(deposit_status);

CREATE TRIGGER IF NOT EXISTS update_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  UPDATE orders SET updatedAt = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

PRAGMA foreign_keys = ON;
