ALTER TABLE users ADD COLUMN access_level TEXT NOT NULL DEFAULT 'CUSTOMER'
  CHECK(access_level IN ('CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'));

UPDATE users SET access_level = role WHERE access_level = 'CUSTOMER' AND role IN ('STAFF', 'ADMIN');
CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level, status);
