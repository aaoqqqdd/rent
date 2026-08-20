-- Risk flags / blacklist (TODO.md P2 #10)
CREATE TABLE IF NOT EXISTS risk_flags (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  flag_type TEXT NOT NULL CHECK(flag_type IN ('PAYMENT_RISK','IDENTITY_RISK','DEVICE_NOT_RETURNED','SERIOUS_DAMAGE','CHARGEBACK','ABUSE','FRAUD_SUSPECTED','MANUAL_REVIEW')),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH')),
  reason TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RESOLVED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  resolution_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_risk_flags_customer_status ON risk_flags(customer_id, status);

-- Stripe chargeback / dispute tracking (TODO.md P2 #9)
CREATE TABLE IF NOT EXISTS payment_disputes (
  id TEXT PRIMARY KEY NOT NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL,
  order_id TEXT,
  customer_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'DISPUTE_OPENED' CHECK(status IN ('DISPUTE_OPENED','DISPUTE_UNDER_REVIEW','DISPUTE_WON','DISPUTE_LOST','DISPUTE_CLOSED')),
  evidence_due_by TEXT,
  evidence_status TEXT,
  result TEXT,
  financial_impact REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_payment ON payment_disputes(payment_id);

-- Public contract verification page (TODO.md P2 #13)
ALTER TABLE contracts ADD COLUMN verification_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_verification_token ON contracts(verification_token);

-- Data consistency check findings (feeds the Exception Queue)
CREATE TABLE IF NOT EXISTS data_consistency_issues (
  id TEXT PRIMARY KEY NOT NULL,
  issue_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_consistency_open_issue ON data_consistency_issues(issue_type, entity_id) WHERE resolved_at IS NULL;
