-- 注意：Cloudflare D1 不允许在 SQL 中使用显式事务语句（BEGIN/COMMIT）
-- 本迁移以逐条 SQL 语句执行，避免使用事务块以兼容 D1 的远程执行限制。

-- 创建一个新的 users 表（snake_case 标准）
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password TEXT,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  bsb TEXT,
  account_number TEXT,
  referrer_id TEXT,
  commission_rate REAL DEFAULT 25.0,
  commission_balance REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  referral_code TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 将现有 users 表的数据迁移到 users_new，支持 camelCase 与 snake_case 的兼容
INSERT INTO users_new (id, name, email, phone, password_hash, password_salt, password, role, status, bsb, account_number, referrer_id, commission_rate, commission_balance, balance, referral_code, created_at, updated_at)
SELECT
  id,
  name,
  email,
  phone,
  -- prefer camelCase source columns which exist on the remote DB
  passwordHash AS password_hash,
  -- password salt camelCase not present on remote in some environments; set NULL
  NULL AS password_salt,
  NULL AS password,
  role,
  COALESCE(status, 'active') AS status,
  bsb,
  accountNumber AS account_number,
  referrerId AS referrer_id,
  commissionRate AS commission_rate,
  commissionBalance AS commission_balance,
  COALESCE(balance, 0) AS balance,
  referralCode AS referral_code,
  COALESCE(createdAt, datetime('now')) AS created_at,
  COALESCE(updatedAt, datetime('now')) AS updated_at
FROM users;

-- 备份旧表并替换（注意：这些操作不是原子性的，执行时请注意并发）
ALTER TABLE users RENAME TO users_old;
ALTER TABLE users_new RENAME TO users;

-- 重新创建触发器（与 0001_schema.sql 保持一致）
DROP TRIGGER IF EXISTS update_users_updated_at;
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- 提醒：此迁移会把 users 表标准化为 snake_case 列名。
-- 在执行前请在可回滚的环境先测试，远程 D1 上执行时可能导致短暂不可用。
