-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

CREATE TABLE IF NOT EXISTS security_rate_limits (
  scope TEXT NOT NULL,
  client_key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(scope, client_key, bucket)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_bucket ON security_rate_limits(bucket);
