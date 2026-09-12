-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- ---------------------------------------------------------------------------
-- Purpose: remove foreign-key clauses that point at tables which no longer
-- exist as real parents. These are fallout from historical
-- `ALTER TABLE ... RENAME TO` migrations: when a table is renamed, SQLite
-- (legacy_alter_table = OFF) rewrites the REFERENCES clauses in *other*
-- tables to the temporary name, and the temp table is then dropped.
--
--   * 0018 renamed `users`  -> `users_old`  (temp kept as a mirror)
--   * 0044 renamed `devices` -> `devices_before_retired_status` (temp kept as a stub)
--   * 0074 renamed `device_commands` -> `device_commands_legacy` (temp dropped)
--
-- D1 does not enforce foreign keys in production, so this has no runtime
-- effect there. But `wrangler d1 execute --local` / `wrangler dev` on current
-- wrangler DO enforce them (PRAGMA foreign_keys = 1), so a plain INSERT into
-- any affected table fails with `FOREIGN KEY constraint failed`, which blocks
-- local testing and seeding.
--
-- Fix policy for each dangling clause:
--   * -> "users_old"                    : DROP the clause. `users_old` is only
--     backfilled once (0069), never trigger-synced, so re-pointing at
--     `users(id)` would introduce an enforced constraint that new rows can
--     fail. The column is kept; only the FK clause goes.
--   * -> "devices_before_retired_status": RE-POINT at `devices(id)`. That stub
--     table is kept in exact sync with `devices` by triggers
--     (`sync_device_legacy_parent_*`, migration 0060), so the constraint is
--     already satisfiable and `devices` is the real intended parent.
--   * -> "device_commands_legacy"       : RE-POINT at `device_commands(id)`,
--     the table that replaced it in 0074 and the original intended parent.
--   FK clauses that already point at live tables (devices, users) are
--   preserved unchanged.
--
-- `commission_records` originally had dangling clauses too, but
-- 0108_unify_referral_reward_ledger.sql already DROP TABLEs it (folded into
-- referral_rewards). There is nothing left here to rebuild for it.
--
-- ---------------------------------------------------------------------------
-- Second purpose, and why this migration ALSO touches contracts/payments and
-- everything that references them (added after two failed production apply
-- attempts): D1 always wraps a migration file in an already-open
-- transaction, which makes `PRAGMA foreign_keys=OFF` a no-op (confirmed by
-- direct reproduction, both via raw SQLite and via `wrangler d1 execute`).
-- With FK enforcement effectively always on, you cannot `DROP TABLE parent`
-- while any OTHER live table still has a plain (non-CASCADE) FK clause
-- pointing at it -- SQLite fails the drop immediately with
-- `FOREIGN KEY constraint failed`, regardless of `defer_foreign_keys`. For an
-- `ON DELETE CASCADE` clause it's worse: the drop silently *cascades*,
-- deleting the referencing rows instead of erroring.
--
-- Concretely: `payments` is referenced by `payment_proofs.payment_id` and
-- `payment_refunds.payment_id` (both plain); `contracts` is referenced by
-- `sign_sessions.contract_token` (CASCADE); `orders` (rebuilt separately by
-- 0130_expand_order_status_check.sql, after this file) is referenced by
-- `contracts.orderId` (CASCADE), `payments.rental_id` (plain), and by
-- `invoices`, `order_time_change_history` (CASCADE),
-- `inspection_disputes` (CASCADE), `order_fulfillment_records` and
-- `damage_cases` (all via `order_id`, plain except noted).
--
-- So every table that references payments/contracts/orders must have that
-- specific FK clause stripped *before* the referenced table is dropped and
-- rebuilt, in this order: payment_proofs, payment_refunds (children of
-- payments) -> payments -> sign_sessions (child of contracts) -> contracts
-- -> [orders' remaining plain children: invoices, order_time_change_history,
-- inspection_disputes, order_fulfillment_records, damage_cases]. D1 doesn't
-- enforce these FKs in production anyway (see above), and the app already
-- deletes payments/contracts/invoices/payment_refunds/payment_proofs
-- explicitly in code (src/index.ts, /admin/orders/:id/delete) rather than
-- relying on DB-level CASCADE, so dropping these clauses for good (matching
-- the users_old policy above, not attempting to re-add them) changes no
-- production behavior and only removes a class of local-dev-only errors.
-- `order_time_change_history` / `inspection_disputes` were the only two
-- CASCADE-linked orders children the app does NOT already clean up manually;
-- src/index.ts's order-delete handler now deletes them explicitly instead
-- (see that commit) so no orphaned rows accumulate going forward.
--
-- Other clauses these tables carry that point at tables NOT being rebuilt
-- here (users, devices, invoices' own self-reference) are left unchanged.
--
-- Pattern (SQLite 12-step table rebuild, same family as 0044 / 0060 / 0074):
--   PRAGMA foreign_keys = OFF; -> CREATE <t>__fk_rebuild (clean) ->
--   INSERT SELECT -> DROP <t> -> ALTER <t>__fk_rebuild RENAME TO <t> ->
--   recreate indexes + triggers -> PRAGMA foreign_keys = ON.
-- Renaming the *__fk_rebuild table (not the original) means SQLite never
-- rewrites child REFERENCES clauses, so tables that are themselves FK targets
-- can be rebuilt without corrupting their (already-stripped) children.
--
-- `PRAGMA legacy_alter_table=ON` is set for the RENAME steps: it prevents
-- SQLite's post-3.25 RENAME from re-parsing every trigger/view in the schema,
-- which would otherwise fail on ones that reference a table momentarily
-- absent mid-rebuild (e.g. `deposit_refunds_cannot_exceed_paid_deposit`
-- references `payments` in its body). It does not by itself avoid the FK
-- constraint-check issue above -- that's why the ordering above is required.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;
PRAGMA legacy_alter_table=ON;

-- === payment_proofs : drop payment_id -> payments AND verified_by -> users_old
CREATE TABLE payment_proofs__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL,
  file_path TEXT,
  reference_number TEXT,
  note TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'submitted',
  rejection_reason TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  image_url TEXT,
  admin_notified_at TEXT
);
INSERT INTO payment_proofs__fk_rebuild (
  id, payment_id, file_path, reference_number, note, uploaded_at, verified_at,
  verified_by, created_at, updated_at, status, rejection_reason, rejected_at,
  rejected_by, image_url, admin_notified_at
)
SELECT
  id, payment_id, file_path, reference_number, note, uploaded_at, verified_at,
  verified_by, created_at, updated_at, status, rejection_reason, rejected_at,
  rejected_by, image_url, admin_notified_at
FROM payment_proofs;
DROP TABLE payment_proofs;
ALTER TABLE payment_proofs__fk_rebuild RENAME TO payment_proofs;

CREATE INDEX idx_payment_proofs_status ON payment_proofs(status, uploaded_at);
CREATE INDEX idx_payment_proofs_review_notification ON payment_proofs(status, admin_notified_at, uploaded_at);

CREATE TRIGGER update_payment_proofs_updated_at
AFTER UPDATE ON payment_proofs
FOR EACH ROW
BEGIN
  UPDATE payment_proofs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === payment_refunds : drop payment_id -> payments ; keep processed_by -> users
CREATE TABLE payment_refunds__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'cancellation')),
  refundable_amount REAL NOT NULL,
  refund_amount REAL NOT NULL,
  deduction_amount REAL NOT NULL DEFAULT 0,
  deduction_reason TEXT,
  stripe_refund_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('succeeded', 'failed')),
  processed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refund_method TEXT NOT NULL DEFAULT 'balance' CHECK(refund_method IN ('balance', 'stripe', 'bank_transfer')),
  refund_bsb TEXT,
  refund_account_number TEXT,
  refund_account_name TEXT,
  refunded_processing_fee REAL NOT NULL DEFAULT 0,
  refund_number TEXT,
  deduction_category TEXT,
  FOREIGN KEY (processed_by) REFERENCES users(id)
);
INSERT INTO payment_refunds__fk_rebuild (
  id, order_id, payment_id, type, refundable_amount, refund_amount,
  deduction_amount, deduction_reason, stripe_refund_id, status, processed_by,
  created_at, refund_method, refund_bsb, refund_account_number,
  refund_account_name, refunded_processing_fee, refund_number, deduction_category
)
SELECT
  id, order_id, payment_id, type, refundable_amount, refund_amount,
  deduction_amount, deduction_reason, stripe_refund_id, status, processed_by,
  created_at, refund_method, refund_bsb, refund_account_number,
  refund_account_name, refunded_processing_fee, refund_number, deduction_category
FROM payment_refunds;
DROP TABLE payment_refunds;
ALTER TABLE payment_refunds__fk_rebuild RENAME TO payment_refunds;

CREATE UNIQUE INDEX idx_payment_refunds_cancellation_once
ON payment_refunds(order_id, type)
WHERE type = 'cancellation' AND status = 'succeeded';
CREATE UNIQUE INDEX idx_payment_refunds_early_return_once
ON payment_refunds(order_id, type)
WHERE type = 'early_return' AND status IN ('pending', 'succeeded');
CREATE UNIQUE INDEX idx_payment_refunds_refund_number ON payment_refunds(refund_number) WHERE refund_number IS NOT NULL;
CREATE INDEX idx_payment_refunds_deduction_category
  ON payment_refunds(deduction_category)
  WHERE deduction_category IS NOT NULL;
CREATE INDEX idx_payment_refunds_deposit_history
ON payment_refunds(order_id, payment_id, status, created_at);

CREATE TRIGGER payment_refunds_to_allocations
AFTER INSERT ON payment_refunds WHEN NEW.status = 'succeeded' BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
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

CREATE TRIGGER payment_refund_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status = 'pending'
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;

CREATE TRIGGER payment_refund_any_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status <> 'succeeded' AND NEW.payment_id IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;

-- === payments : drop customer_id -> users_old AND rental_id -> orders ======
-- (rental_id must go too: nothing may still reference `payments` above this
-- point, but `payments` itself must stop referencing `orders` before
-- 0130_expand_order_status_check.sql drops and rebuilds `orders`.)
CREATE TABLE payments__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  rental_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'bank_transfer', 'balance')),
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
);
INSERT INTO payments__fk_rebuild (
  id, rental_id, customer_id, payment_method, amount, deposit_amount,
  rental_amount, currency, status, transaction_id, paid_at, created_at,
  updated_at, stripe_checkout_session_id, stripe_payment_intent_id, processing_fee
)
SELECT
  id, rental_id, customer_id, payment_method, amount, deposit_amount,
  rental_amount, currency, status, transaction_id, paid_at, created_at,
  updated_at, stripe_checkout_session_id, stripe_payment_intent_id, processing_fee
FROM payments;
DROP TABLE payments;
ALTER TABLE payments__fk_rebuild RENAME TO payments;

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

-- === sign_sessions : drop contract_token -> contracts (was ON DELETE CASCADE)
CREATE TABLE sign_sessions__fk_rebuild (
    token TEXT PRIMARY KEY NOT NULL,
    contract_token TEXT NOT NULL,
    session_data TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO sign_sessions__fk_rebuild (
  token, contract_token, session_data, expires_at, created_at, updated_at
)
SELECT
  token, contract_token, session_data, expires_at, created_at, updated_at
FROM sign_sessions;
DROP TABLE sign_sessions;
ALTER TABLE sign_sessions__fk_rebuild RENAME TO sign_sessions;

CREATE INDEX idx_sign_sessions_expires_at ON sign_sessions(expires_at);
CREATE INDEX idx_sign_sessions_contract_token ON sign_sessions(contract_token);

-- === contracts : drop created_by -> users_old AND orderId -> orders ========
CREATE TABLE contracts__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL,
  contractNumber TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  signedAt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_sign', 'signed', 'cancelled')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signToken TEXT,
  sign_token TEXT,
  sign_valid_days INTEGER DEFAULT 7,
  sign_expires_at TEXT,
  validFrom TEXT,
  validUntil TEXT,
  created_by TEXT,
  deleted_at TEXT,
  signExpiresAt TEXT,
  signValidDays INTEGER DEFAULT 7,
  device_condition TEXT,
  device_accessories TEXT,
  late_fee_per_day REAL NOT NULL DEFAULT 0,
  repair_cost REAL,
  pickup_location TEXT,
  return_location TEXT,
  esign_ip TEXT,
  esign_device TEXT,
  contract_data TEXT NOT NULL DEFAULT '{}',
  signed_content TEXT,
  content_hash TEXT,
  privacy_policy_accepted BOOLEAN NOT NULL DEFAULT 0,
  privacy_policy_version TEXT,
  privacy_policy_accepted_at TEXT,
  privacy_policy_accepted_ip TEXT,
  verification_token TEXT
);
INSERT INTO contracts__fk_rebuild (
  id, orderId, contractNumber, content, signedAt, status, createdAt, updatedAt,
  signToken, sign_token, sign_valid_days, sign_expires_at, validFrom, validUntil,
  created_by, deleted_at, signExpiresAt, signValidDays, device_condition,
  device_accessories, late_fee_per_day, repair_cost, pickup_location,
  return_location, esign_ip, esign_device, contract_data, signed_content,
  content_hash, privacy_policy_accepted, privacy_policy_version,
  privacy_policy_accepted_at, privacy_policy_accepted_ip, verification_token
)
SELECT
  id, orderId, contractNumber, content, signedAt, status, createdAt, updatedAt,
  signToken, sign_token, sign_valid_days, sign_expires_at, validFrom, validUntil,
  created_by, deleted_at, signExpiresAt, signValidDays, device_condition,
  device_accessories, late_fee_per_day, repair_cost, pickup_location,
  return_location, esign_ip, esign_device, contract_data, signed_content,
  content_hash, privacy_policy_accepted, privacy_policy_version,
  privacy_policy_accepted_at, privacy_policy_accepted_ip, verification_token
FROM contracts;
DROP TABLE contracts;
ALTER TABLE contracts__fk_rebuild RENAME TO contracts;

-- sign_sessions.contract_token -> contracts(sign_token) needs this UNIQUE index.
CREATE UNIQUE INDEX idx_contracts_sign_token ON contracts(sign_token);
CREATE INDEX idx_contracts_sign_expires_at ON contracts(sign_expires_at);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_deleted_at ON contracts(deleted_at);
CREATE INDEX idx_contracts_sign_expires_at_camel ON contracts(signExpiresAt);
CREATE UNIQUE INDEX idx_contracts_verification_token ON contracts(verification_token);

CREATE TRIGGER update_contracts_updated_at
AFTER UPDATE ON contracts
FOR EACH ROW
BEGIN
  UPDATE contracts SET updatedAt = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === invoices : drop order_id -> orders ; keep related_invoice_id (self) ===
CREATE TABLE invoices__fk_rebuild (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('invoice', 'credit_note')),
  subtotal REAL NOT NULL,
  gst_amount REAL NOT NULL,
  deposit_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL,
  related_invoice_id TEXT,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_fee REAL NOT NULL DEFAULT 0,
  receipt_number TEXT,
  FOREIGN KEY(related_invoice_id) REFERENCES invoices(id)
);
INSERT INTO invoices__fk_rebuild (
  id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount,
  total_amount, currency, status, related_invoice_id, issued_at,
  processing_fee, receipt_number
)
SELECT
  id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount,
  total_amount, currency, status, related_invoice_id, issued_at,
  processing_fee, receipt_number
FROM invoices;
DROP TABLE invoices;
ALTER TABLE invoices__fk_rebuild RENAME TO invoices;

CREATE UNIQUE INDEX idx_invoice_order_type ON invoices(order_id, type);
CREATE UNIQUE INDEX idx_invoices_receipt_number ON invoices(receipt_number) WHERE receipt_number IS NOT NULL;

-- === order_time_change_history : drop order_id -> orders (was CASCADE) ====
CREATE TABLE order_time_change_history__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  previous_pickup_slot TEXT,
  previous_return_slot TEXT,
  pickup_slot TEXT NOT NULL,
  return_slot TEXT NOT NULL,
  additional_service_fee REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO order_time_change_history__fk_rebuild (
  id, order_id, changed_by, previous_pickup_slot, previous_return_slot,
  pickup_slot, return_slot, additional_service_fee, created_at
)
SELECT
  id, order_id, changed_by, previous_pickup_slot, previous_return_slot,
  pickup_slot, return_slot, additional_service_fee, created_at
FROM order_time_change_history;
DROP TABLE order_time_change_history;
ALTER TABLE order_time_change_history__fk_rebuild RENAME TO order_time_change_history;

CREATE INDEX idx_order_time_changes_order ON order_time_change_history(order_id, created_at DESC);

-- === inspection_disputes : drop order_id -> orders (was CASCADE) ==========
-- customer_id -> users(id) ON DELETE CASCADE is untouched (users isn't
-- being rebuilt by this migration or 0130).
CREATE TABLE inspection_disputes__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO inspection_disputes__fk_rebuild (
  id, order_id, customer_id, message, status, created_at
)
SELECT
  id, order_id, customer_id, message, status, created_at
FROM inspection_disputes;
DROP TABLE inspection_disputes;
ALTER TABLE inspection_disputes__fk_rebuild RENAME TO inspection_disputes;

CREATE INDEX idx_inspection_disputes_order ON inspection_disputes(order_id, created_at DESC);

-- === order_fulfillment_records : drop order_id -> orders ===================
CREATE TABLE order_fulfillment_records__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK(record_type IN ('HANDOVER', 'RETURN')),
  device_serial_number TEXT NOT NULL,
  accessories_json TEXT NOT NULL DEFAULT '[]',
  condition_snapshot_json TEXT NOT NULL DEFAULT '{}',
  customer_confirmed INTEGER NOT NULL DEFAULT 0,
  customer_confirmation_name TEXT,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
INSERT INTO order_fulfillment_records__fk_rebuild (
  id, order_id, record_type, device_serial_number, accessories_json,
  condition_snapshot_json, customer_confirmed, customer_confirmation_name,
  notes, recorded_by, recorded_at
)
SELECT
  id, order_id, record_type, device_serial_number, accessories_json,
  condition_snapshot_json, customer_confirmed, customer_confirmation_name,
  notes, recorded_by, recorded_at
FROM order_fulfillment_records;
DROP TABLE order_fulfillment_records;
ALTER TABLE order_fulfillment_records__fk_rebuild RENAME TO order_fulfillment_records;

CREATE UNIQUE INDEX idx_order_fulfillment_once
  ON order_fulfillment_records(order_id, record_type);

-- === damage_cases : drop order_id -> orders ================================
CREATE TABLE damage_cases__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_urls TEXT NOT NULL DEFAULT '',
  liability_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(liability_status IN ('PENDING', 'CUSTOMER', 'WAIVED', 'DISPUTED')),
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  final_cost_cents INTEGER,
  repair_invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'QUOTED', 'DISPUTED', 'RESOLVED', 'WAIVED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
INSERT INTO damage_cases__fk_rebuild (
  id, order_id, device_id, description, photo_urls, liability_status,
  estimated_cost_cents, final_cost_cents, repair_invoice_url, status,
  created_by, created_at, resolved_at
)
SELECT
  id, order_id, device_id, description, photo_urls, liability_status,
  estimated_cost_cents, final_cost_cents, repair_invoice_url, status,
  created_by, created_at, resolved_at
FROM damage_cases;
DROP TABLE damage_cases;
ALTER TABLE damage_cases__fk_rebuild RENAME TO damage_cases;

CREATE INDEX idx_damage_cases_order ON damage_cases(order_id, status, created_at DESC);

-- === commission_withdrawals : drop user_id / processed_by -> users_old =====
CREATE TABLE commission_withdrawals__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  bsb TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'completed', 'rejected')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  processed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  account_name TEXT
);
INSERT INTO commission_withdrawals__fk_rebuild (
  id, user_id, amount, bsb, account_number, status, requested_at, processed_at,
  processed_by, created_at, updated_at, account_name
)
SELECT
  id, user_id, amount, bsb, account_number, status, requested_at, processed_at,
  processed_by, created_at, updated_at, account_name
FROM commission_withdrawals;
DROP TABLE commission_withdrawals;
ALTER TABLE commission_withdrawals__fk_rebuild RENAME TO commission_withdrawals;

CREATE TRIGGER update_commission_withdrawals_updated_at
AFTER UPDATE ON commission_withdrawals
FOR EACH ROW
BEGIN
  UPDATE commission_withdrawals SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === addresses : drop user_id -> users_old (was ON DELETE CASCADE) ========
CREATE TABLE addresses__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO addresses__fk_rebuild (
  id, user_id, address_line1, address_line2, city, state, postcode, country,
  is_default, created_at, updated_at
)
SELECT
  id, user_id, address_line1, address_line2, city, state, postcode, country,
  is_default, created_at, updated_at
FROM addresses;
DROP TABLE addresses;
ALTER TABLE addresses__fk_rebuild RENAME TO addresses;

CREATE TRIGGER update_addresses_updated_at
AFTER UPDATE ON addresses
FOR EACH ROW
BEGIN
  UPDATE addresses SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === device_entries : re-point device_id -> devices ; drop created_by =====
CREATE TABLE device_entries__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  supplier TEXT,
  purchase_price REAL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
INSERT INTO device_entries__fk_rebuild (
  id, device_id, entry_date, quantity, supplier, purchase_price, note,
  created_by, created_at, updated_at
)
SELECT
  id, device_id, entry_date, quantity, supplier, purchase_price, note,
  created_by, created_at, updated_at
FROM device_entries;
DROP TABLE device_entries;
ALTER TABLE device_entries__fk_rebuild RENAME TO device_entries;

CREATE TRIGGER update_device_entries_updated_at
AFTER UPDATE ON device_entries
FOR EACH ROW
BEGIN
  UPDATE device_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === device_maintenance : re-point device_id -> devices ==================
CREATE TABLE device_maintenance__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  maintenance_date TEXT NOT NULL,
  cost REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
INSERT INTO device_maintenance__fk_rebuild (
  id, device_id, issue_description, maintenance_date, cost, status, note,
  created_at, updated_at
)
SELECT
  id, device_id, issue_description, maintenance_date, cost, status, note,
  created_at, updated_at
FROM device_maintenance;
DROP TABLE device_maintenance;
ALTER TABLE device_maintenance__fk_rebuild RENAME TO device_maintenance;

CREATE TRIGGER update_device_maintenance_updated_at
AFTER UPDATE ON device_maintenance
FOR EACH ROW
BEGIN
  UPDATE device_maintenance SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- === error_logs : drop user_id -> users_old (was ON DELETE SET NULL) =====
CREATE TABLE error_logs__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  error_level TEXT NOT NULL CHECK(error_level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context_data TEXT,
  user_id TEXT,
  request_url TEXT,
  request_method TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO error_logs__fk_rebuild (
  id, error_level, error_message, error_stack, context_data, user_id,
  request_url, request_method, created_at
)
SELECT
  id, error_level, error_message, error_stack, context_data, user_id,
  request_url, request_method, created_at
FROM error_logs;
DROP TABLE error_logs;
ALTER TABLE error_logs__fk_rebuild RENAME TO error_logs;

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX idx_error_logs_level ON error_logs(error_level);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);

-- === device_command_results : re-point command_id -> device_commands ====
-- ===                          keep device_id -> devices             ====
-- Current production schema for this table already carries no FK clause at
-- all (the device_commands_legacy target was dropped some time after this
-- table was last touched), so this adds the intended constraint fresh
-- rather than fixing a dangling one; verified command_id/device_id values
-- already match device_commands/devices with zero orphans.
CREATE TABLE device_command_results__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  result_code TEXT NOT NULL,
  result_message TEXT,
  executed_at TEXT NOT NULL,
  reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (command_id) REFERENCES device_commands(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
INSERT INTO device_command_results__fk_rebuild (
  id, command_id, device_id, success, result_code, result_message,
  executed_at, reported_at
)
SELECT
  id, command_id, device_id, success, result_code, result_message,
  executed_at, reported_at
FROM device_command_results;
DROP TABLE device_command_results;
ALTER TABLE device_command_results__fk_rebuild RENAME TO device_command_results;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
