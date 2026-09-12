-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Keep one historical reminder per customer, order, and reminder type before
-- adding the unique guard used by INSERT OR IGNORE in the cron job.
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;

-- Remove exact duplicate agreement-update notifications created by repeated
-- saves before the per-recipient idempotency key was introduced.
DELETE FROM notifications
WHERE type = 'agreement_update'
  AND id NOT IN (
    SELECT MIN(id)
    FROM notifications
    WHERE type = 'agreement_update'
    GROUP BY recipient_id, type, title, message
  );
DELETE FROM notifications
WHERE type IN ('due_soon_3d', 'due_today')
  AND order_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM notifications
    WHERE type IN ('due_soon_3d', 'due_today')
      AND order_id IS NOT NULL
    GROUP BY recipient_id, order_id, type
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_due_once
  ON notifications(recipient_id, order_id, type)
  WHERE order_id IS NOT NULL AND type IN ('due_soon_3d', 'due_today');

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications(recipient_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
