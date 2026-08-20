ALTER TABLE stripe_webhook_events ADD COLUMN payload_hash TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(processing_status IN ('RECEIVED','PROCESSED','FAILED'));
ALTER TABLE stripe_webhook_events ADD COLUMN failure_reason TEXT;
-- SQLite/D1 does not permit CURRENT_TIMESTAMP as the default when a column is
-- added to an existing table. Existing events retain their original receipt
-- time via processed_at; new events supply received_at explicitly in code.
ALTER TABLE stripe_webhook_events ADD COLUMN received_at TEXT;
UPDATE stripe_webhook_events SET received_at = processed_at WHERE received_at IS NULL;
