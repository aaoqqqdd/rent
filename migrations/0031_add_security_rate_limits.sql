CREATE TABLE IF NOT EXISTS security_rate_limits (
  scope TEXT NOT NULL,
  client_key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(scope, client_key, bucket)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_bucket ON security_rate_limits(bucket);

