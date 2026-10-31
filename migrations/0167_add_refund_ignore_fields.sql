-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE orders ADD COLUMN refund_ignored_at TEXT;
ALTER TABLE orders ADD COLUMN refund_ignored_by TEXT;
ALTER TABLE orders ADD COLUMN refund_ignore_reason TEXT;
