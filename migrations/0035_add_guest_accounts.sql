-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.

ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'formal' CHECK(account_type IN ('formal', 'guest', 'deleted_guest'));
ALTER TABLE users ADD COLUMN guest_order_id TEXT;
ALTER TABLE users ADD COLUMN guest_expires_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_guest_expiry ON users(account_type, guest_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_guest_order ON users(guest_order_id);
