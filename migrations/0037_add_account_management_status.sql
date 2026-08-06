-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Adds administrative lifecycle states without changing the legacy login-status constraint.

ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
  CHECK(account_status IN ('active', 'banned', 'inactive', 'departed'));

UPDATE users SET account_status = CASE WHEN status = 'active' THEN 'active' ELSE 'inactive' END;

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status, role);
