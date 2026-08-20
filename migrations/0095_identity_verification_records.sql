CREATE TABLE IF NOT EXISTS identity_verification_records (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('NOT_REQUIRED','PENDING','VERIFIED','REJECTED','EXPIRED')),
  verification_method TEXT,
  document_last4 TEXT,
  rejection_reason TEXT,
  verified_by TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_identity_verification_customer ON identity_verification_records(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sensitive_data_access_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_target ON sensitive_data_access_logs(target_user_id, created_at DESC);
