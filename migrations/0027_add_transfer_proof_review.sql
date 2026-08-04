-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE payment_proofs ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE payment_proofs ADD COLUMN rejection_reason TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_at TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_by TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status, uploaded_at);
