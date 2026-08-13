-- Add the requested formal administrator account.
-- The password is stored as a PBKDF2-SHA256 hash, never in plaintext.
INSERT INTO users (
  id, name, email, password_hash, role, status, balance,
  commission_balance, created_at, updated_at
) VALUES (
  'AD-00000001',
  'Minkang',
  'heminkang2@gmail.com',
  'pbkdf2$100000$5639ae73051b6502965b8f56d7e0800f$86de97a9bd36e0f8cfbc773c9fc7549a563b33244dda44bbbdebda1fc4c3016d',
  'ADMIN',
  'active',
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'ADMIN',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;
