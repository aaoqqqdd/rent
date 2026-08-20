ALTER TABLE stripe_webhook_events ADD COLUMN payload_hash TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(processing_status IN ('RECEIVED','PROCESSED','FAILED'));
ALTER TABLE stripe_webhook_events ADD COLUMN failure_reason TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
