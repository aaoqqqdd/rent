-- 电脑租赁网站数据库 Schema (基于 requirements_note.txt)
-- Cloudflare D1 / SQLite 兼容

-- 删除旧表以确保全新创建
DROP TABLE IF EXISTS commission_withdrawals;
DROP TABLE IF EXISTS commission_records;
DROP TABLE IF EXISTS payment_proofs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS rentals;
DROP TABLE IF EXISTS device_maintenance;
DROP TABLE IF EXISTS device_entries;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;

-- -----------------------------------------------------
-- 表 `users`
-- -----------------------------------------------------
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  bsb TEXT,
  account_number TEXT,
  referrer_id TEXT,
  commission_rate REAL DEFAULT 25.0,
  commission_balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -----------------------------------------------------
-- 表 `devices`
-- -----------------------------------------------------
CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  price_per_day REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'rented', 'maintenance')),
  description TEXT,
  serial_number TEXT NOT NULL UNIQUE,
  entry_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- 表 `rentals` (订单表)
-- -----------------------------------------------------
CREATE TABLE rentals (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rental_period INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_payment', 'paid', 'active', 'completed', 'cancelled')),
  payment_method TEXT CHECK(payment_method IN ('card', 'bank_transfer', 'balance')),
  contract_signed BOOLEAN NOT NULL DEFAULT 0,
  referrer_id TEXT,
  commission_rate REAL,
  commission_amount REAL,
  square_payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -----------------------------------------------------
-- 表 `contracts`
-- -----------------------------------------------------
CREATE TABLE contracts (
  id TEXT PRIMARY KEY NOT NULL,
  rental_id TEXT NOT NULL,
  contract_number TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_sign', 'signed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- 表 `payments`
-- -----------------------------------------------------
CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  rental_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'bank_transfer', 'balance')),
  amount REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  rental_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'refunded')),
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rental_id) REFERENCES rentals(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- -----------------------------------------------------
-- 表 `payment_proofs` (银行转账凭证)
-- -----------------------------------------------------
CREATE TABLE payment_proofs (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL,
  file_path TEXT,
  reference_number TEXT,
  note TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- -----------------------------------------------------
-- 表 `commission_records` (推荐分成记录)
-- -----------------------------------------------------
CREATE TABLE commission_records (
  id TEXT PRIMARY KEY NOT NULL,
  referrer_id TEXT NOT NULL,
  rental_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'settled', 'withdrawn')),
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (rental_id) REFERENCES rentals(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- -----------------------------------------------------
-- 表 `commission_withdrawals` (佣金提现记录)
-- -----------------------------------------------------
CREATE TABLE commission_withdrawals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  bsb TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'completed', 'rejected')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  processed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);

-- -----------------------------------------------------
-- 表 `addresses`
-- -----------------------------------------------------
CREATE TABLE addresses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- 表 `device_entries` (设备入库记录)
-- -----------------------------------------------------
CREATE TABLE device_entries (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  supplier TEXT,
  purchase_price REAL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- -----------------------------------------------------
-- 表 `device_maintenance` (设备维修记录)
-- -----------------------------------------------------
CREATE TABLE device_maintenance (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  maintenance_date TEXT NOT NULL,
  cost REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- -----------------------------------------------------
-- 初始数据
-- -----------------------------------------------------
-- 初始测试用户（密码需要在应用程序中重新哈希处理，这里仅作为结构示例）
INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at) VALUES
('u-admin', 'Admin User', 'admin@example.com', '3b612c75a7b5048a435fb6ec81e52ff92d6d795a8b5a9c17070f6a63c97a53b2', 'ADMIN', 'active', '2026-07-01 00:00:00', '2026-07-01 00:00:00'),
('u-staff', 'Staff User', 'staff@example.com', '2f005e42a17da46ec51ba6f11d725e60788931a1dadd33d9cb85084fb32bb166', 'STAFF', 'active', '2026-07-01 00:00:00', '2026-07-01 00:00:00'),
('u-customer', 'Customer User', 'customer@example.com', 'e6f59d120b99238e3a81b7322136ac9be6f9e27c764f8daca738f68c16a62202', 'CUSTOMER', 'active', '2026-07-01 00:00:00', '2026-07-01 00:00:00');

-- 初始设备数据
INSERT INTO devices (id, name, model, price_per_day, deposit_amount, status, serial_number, entry_date) VALUES
('d-mbp14', 'MacBook Pro 14', 'M4 Pro', 40.0, 2000.0, 'available', 'SN-MBP14-001', '2026-07-01'),
('d-xps13', 'Dell XPS 13', 'Intel i7', 35.0, 1500.0, 'available', 'SN-XPS13-001', '2026-07-01');

-- 触发器：自动更新 updated_at 时间戳
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_devices_updated_at
AFTER UPDATE ON devices
FOR EACH ROW
BEGIN
  UPDATE devices SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_rentals_updated_at
AFTER UPDATE ON rentals
FOR EACH ROW
BEGIN
  UPDATE rentals SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_contracts_updated_at
AFTER UPDATE ON contracts
FOR EACH ROW
BEGIN
  UPDATE contracts SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payments_updated_at
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
  UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payment_proofs_updated_at
AFTER UPDATE ON payment_proofs
FOR EACH ROW
BEGIN
  UPDATE payment_proofs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_addresses_updated_at
AFTER UPDATE ON addresses
FOR EACH ROW
BEGIN
  UPDATE addresses SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_device_entries_updated_at
AFTER UPDATE ON device_entries
FOR EACH ROW
BEGIN
  UPDATE device_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_device_maintenance_updated_at
AFTER UPDATE ON device_maintenance
FOR EACH ROW
BEGIN
  UPDATE device_maintenance SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_commission_records_updated_at
AFTER UPDATE ON commission_records
FOR EACH ROW
BEGIN
  UPDATE commission_records SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_commission_withdrawals_updated_at
AFTER UPDATE ON commission_withdrawals
FOR EACH ROW
BEGIN
  UPDATE commission_withdrawals SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;