-- 修复 0018 迁移遗留：`users` 改名为 `users_old` 时 SQLite 把 orders / contracts /
-- payments / commission_records / addresses 等子表的外键改写为指向 `users_old`，
-- 但没有回修，新的 `users` 表与旧外键并存。0069 做过一次性回填，之后新建的用户
-- 没有再同步，导致在启用外键校验的运行时（wrangler dev / d1 execute --local）里
-- 无法为新用户插入订单 / 合同 / 付款等子行（FOREIGN KEY constraint failed）。
-- 处理方式与 0060 对 devices_before_retired_status 完全一致：补齐回填 + 加同步
-- 触发器，让 `users_old` 始终是 `users` 的镜像父表。生产环境 D1 默认不校验外键，
-- 此改动只是让镜像保持正确，不改变业务行为。
PRAGMA foreign_keys=OFF;

-- 回填 0069 之后新建、但不在 users_old 中的用户。referrerId 置空以避免自引用外键
-- 的插入顺序问题——子表外键只关心 id 是否存在。
INSERT OR IGNORE INTO users_old (
  id, name, email, phone, passwordHash, role, status, bsb, accountNumber,
  referrerId, commissionRate, commissionBalance, balance, createdAt, updatedAt, referralCode
)
SELECT
  id, COALESCE(name, email, id), email, phone,
  COALESCE(password_hash, password, 'legacy-account'),
  role, COALESCE(status, 'active'), bsb, account_number,
  NULL, COALESCE(commission_rate, 25.0), COALESCE(commission_balance, 0),
  COALESCE(balance, 0), COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP), referral_code
FROM users
WHERE id NOT IN (SELECT id FROM users_old);

CREATE TRIGGER IF NOT EXISTS sync_users_legacy_parent_insert
AFTER INSERT ON users
BEGIN
  INSERT OR IGNORE INTO users_old (
    id, name, email, phone, passwordHash, role, status, bsb, accountNumber,
    referrerId, commissionRate, commissionBalance, balance, createdAt, updatedAt, referralCode
  ) VALUES (
    NEW.id, COALESCE(NEW.name, NEW.email, NEW.id), NEW.email, NEW.phone,
    COALESCE(NEW.password_hash, NEW.password, 'legacy-account'),
    NEW.role, COALESCE(NEW.status, 'active'), NEW.bsb, NEW.account_number,
    NULL, COALESCE(NEW.commission_rate, 25.0), COALESCE(NEW.commission_balance, 0),
    COALESCE(NEW.balance, 0), COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
    COALESCE(NEW.updated_at, CURRENT_TIMESTAMP), NEW.referral_code
  );
END;

-- id 不可变，子表外键完整性只靠 INSERT 触发器即可；这条只是让镜像的可读字段
-- 跟随主表，方便任何直接读 users_old 的历史查询。
CREATE TRIGGER IF NOT EXISTS sync_users_legacy_parent_update
AFTER UPDATE ON users
BEGIN
  UPDATE users_old SET
    name = COALESCE(NEW.name, NEW.email, NEW.id),
    email = NEW.email, phone = NEW.phone, role = NEW.role,
    status = COALESCE(NEW.status, 'active'), bsb = NEW.bsb, accountNumber = NEW.account_number,
    commissionBalance = COALESCE(NEW.commission_balance, 0), balance = COALESCE(NEW.balance, 0),
    updatedAt = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP), referralCode = NEW.referral_code
  WHERE id = NEW.id;
END;

PRAGMA foreign_keys=ON;
