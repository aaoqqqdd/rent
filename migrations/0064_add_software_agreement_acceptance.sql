ALTER TABLE users ADD COLUMN software_agreement_accepted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN software_agreement_version TEXT;
ALTER TABLE users ADD COLUMN software_agreement_accepted_at TEXT;
ALTER TABLE users ADD COLUMN software_agreement_accepted_ip TEXT;
