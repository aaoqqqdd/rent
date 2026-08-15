ALTER TABLE payment_proofs ADD COLUMN admin_notified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_payment_proofs_review_notification ON payment_proofs(status, admin_notified_at, uploaded_at);
