ALTER TABLE notifications ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_sender_created
  ON notifications(sender_id, deleted_at, created_at DESC);
