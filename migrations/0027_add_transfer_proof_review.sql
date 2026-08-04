ALTER TABLE payment_proofs ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE payment_proofs ADD COLUMN rejection_reason TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_at TEXT;
ALTER TABLE payment_proofs ADD COLUMN rejected_by TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status, uploaded_at);

