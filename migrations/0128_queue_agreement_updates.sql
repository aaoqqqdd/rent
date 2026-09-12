-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Protocol changes are collected here and delivered by the scheduled job as
-- one customer notification per batch. A new revision prevents a save that
-- happens while a batch is being delivered from being lost by its cleanup.
CREATE TABLE IF NOT EXISTS agreement_update_queue (
  agreement_key TEXT PRIMARY KEY NOT NULL,
  agreement_label TEXT NOT NULL,
  revision TEXT NOT NULL,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agreement_update_queue_queued
  ON agreement_update_queue(queued_at, agreement_key);

-- Drop older duplicate backlog entries before the new batcher starts. Keep
-- the newest unsent email and newest in-app notice for each customer.
DELETE FROM email_events
WHERE event_type = 'AGREEMENT_UPDATE'
  AND status IN ('PENDING', 'FAILED')
  AND EXISTS (
    SELECT 1
    FROM email_events newer
    WHERE newer.event_type = email_events.event_type
      AND newer.recipient = email_events.recipient
      AND newer.status IN ('PENDING', 'FAILED')
      AND (newer.created_at > email_events.created_at
        OR (newer.created_at = email_events.created_at AND newer.rowid > email_events.rowid))
  );

DELETE FROM notifications
WHERE type = 'agreement_update'
  AND EXISTS (
    SELECT 1
    FROM notifications newer
    WHERE newer.type = notifications.type
      AND newer.recipient_id = notifications.recipient_id
      AND (newer.created_at > notifications.created_at
        OR (newer.created_at = notifications.created_at AND newer.rowid > notifications.rowid))
  );

-- Old agreement emails were created directly by the save request and have no
-- batch marker. They must not be sent after this migration; new batches use
-- template_id = 'agreement_update_batch'.
UPDATE email_events
SET status = 'SKIPPED', error_message = '旧协议更新积压已停止发送'
WHERE event_type = 'AGREEMENT_UPDATE'
  AND template_id IS NULL
  AND status IN ('PENDING', 'FAILED');
