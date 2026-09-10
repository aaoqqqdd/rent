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
--   FK clauses that already point at live tables (payments, orders, devices)
--   are preserved unchanged.
--
-- Pattern (SQLite 12-step table rebuild, same family as 0044 / 0060 / 0074):
--   PRAGMA foreign_keys = OFF; -> CREATE <t>__fk_rebuild (clean) ->
--   INSERT SELECT -> DROP <t> -> ALTER <t>__fk_rebuild RENAME TO <t> ->
--   recreate indexes + triggers -> PRAGMA foreign_keys = ON.
-- Renaming the *__fk_rebuild table (not the original) means SQLite never
-- rewrites child REFERENCES clauses, so tables that are themselves FK targets
-- (contracts, payments) can be rebuilt without corrupting their children.
--
-- `PRAGMA legacy_alter_table=ON` is required for the RENAME step: wrangler
-- runs a migration file inside a transaction, which makes
-- `PRAGMA foreign_keys=OFF` a no-op, so the post-3.25 RENAME would re-parse
-- every trigger/view in the schema and fail on ones that reference a table
-- that is momentarily absent mid-rebuild (e.g. the
-- `refund_allocations_cannot_exceed_payment` trigger references `payments`).
-- The legacy RENAME skips that whole-schema re-validation.
--
-- NOT handled here: `orders`. It carries three dangling clauses
-- (userId -> users_old, referrerId -> users_old, deviceId ->
-- devices_before_retired_status) but is referenced by 8 child tables
-- (commission_records, contracts, damage_cases, inspection_disputes,
-- invoices, order_fulfillment_records, order_time_change_history, payments),
-- 3 of them ON DELETE CASCADE, plus 4 indexes and a trigger, and has ~58
-- columns accreted across dozens of migrations. Rebuilding it is deferred to
-- its own migration so it can be tested against a populated database.
-- See docs/dangling-foreign-keys.md for the full analysis and procedure.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

-- === payments : drop customer_id -> users_old ; keep rental_id -> orders ====
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
  processing_fee REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (rental_id) REFERENCES orders(id)
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

-- === contracts : drop created_by -> users_old ; keep orderId -> orders =====
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
  verification_token TEXT,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
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

-- === payment_proofs : drop verified_by -> users_old ; keep payment_id ======
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
  admin_notified_at TEXT,
  FOREIGN KEY (payment_id) REFERENCES payments(id)
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

-- === commission_records : drop referrer_id / customer_id -> users_old ======
-- ===                      keep rental_id -> orders                    ======
CREATE TABLE commission_records__fk_rebuild (
  id TEXT PRIMARY KEY NOT NULL,
  referrer_id TEXT NOT NULL,
  rental_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'settled', 'withdrawn')),
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referrerId TEXT,
  orderId TEXT,
  userId TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (rental_id) REFERENCES orders(id)
);
INSERT INTO commission_records__fk_rebuild (
  id, referrer_id, rental_id, customer_id, amount, rate, status, settled_at,
  created_at, updated_at, referrerId, orderId, userId, createdAt, updatedAt
)
SELECT
  id, referrer_id, rental_id, customer_id, amount, rate, status, settled_at,
  created_at, updated_at, referrerId, orderId, userId, createdAt, updatedAt
FROM commission_records;
DROP TABLE commission_records;
ALTER TABLE commission_records__fk_rebuild RENAME TO commission_records;

CREATE INDEX idx_commission_records_referrerId ON commission_records(referrerId);
CREATE INDEX idx_commission_records_orderId ON commission_records(orderId);
CREATE INDEX idx_commission_records_userId ON commission_records(userId);

CREATE TRIGGER update_commission_records_updated_at
AFTER UPDATE ON commission_records
FOR EACH ROW
BEGIN
  UPDATE commission_records SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

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
