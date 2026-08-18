-- Keep legacy orders/contracts foreign keys valid while the schema is being
-- transitioned from users_old to users. Existing production tables still
-- reference users_old, so every current account needs a compatible mirror.
INSERT OR IGNORE INTO users_old (
  id, name, email, phone, passwordHash, role, status, bsb, accountNumber,
  referrerId, commissionRate, commissionBalance, balance, createdAt, updatedAt
)
SELECT
  id,
  COALESCE(name, email, id),
  email,
  phone,
  COALESCE(password_hash, password, 'legacy-account'),
  role,
  COALESCE(status, 'active'),
  bsb,
  account_number,
  referrer_id,
  commission_rate,
  commission_balance,
  balance,
  COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM users;
