-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE orders ADD COLUMN deleted_at TEXT;
ALTER TABLE devices ADD COLUMN deleted_at TEXT;
ALTER TABLE coupons ADD COLUMN deleted_at TEXT;
ALTER TABLE email_templates ADD COLUMN deleted_at TEXT;
ALTER TABLE in_app_notification_templates ADD COLUMN deleted_at TEXT;
ALTER TABLE marketing_email_templates ADD COLUMN deleted_at TEXT;
ALTER TABLE device_unavailable_dates ADD COLUMN deleted_at TEXT;
ALTER TABLE device_unavailable_time_slots ADD COLUMN deleted_at TEXT;
