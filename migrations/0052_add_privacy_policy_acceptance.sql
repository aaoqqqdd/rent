ALTER TABLE contracts ADD COLUMN privacy_policy_accepted BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN privacy_policy_version TEXT;
ALTER TABLE contracts ADD COLUMN privacy_policy_accepted_at TEXT;
ALTER TABLE contracts ADD COLUMN privacy_policy_accepted_ip TEXT;
