ALTER TABLE email_events ADD COLUMN subject TEXT;
ALTER TABLE email_events ADD COLUMN text_body TEXT;
ALTER TABLE email_events ADD COLUMN html_body TEXT;
ALTER TABLE email_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_events ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE email_events ADD COLUMN last_attempt_at TEXT;
CREATE INDEX IF NOT EXISTS idx_email_events_retry ON email_events(status, retry_count, created_at);
