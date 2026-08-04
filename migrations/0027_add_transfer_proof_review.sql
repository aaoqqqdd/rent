-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

ALTER TABLE payment_proofs ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE payment_proofs ADD COLUMN rejection_reason TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_at TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_by TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status, uploaded_at);
