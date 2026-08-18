CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  order_id TEXT,
  template_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('PENDING','SENT','FAILED','SKIPPED')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_events_order ON email_events(order_id, created_at DESC);

ALTER TABLE users ADD COLUMN identity_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
  CHECK(identity_status IN ('NOT_REQUIRED','NOT_VERIFIED','PENDING','VERIFIED','FAILED','EXPIRED','REVIEW_REQUIRED'));
ALTER TABLE users ADD COLUMN identity_document_last4 TEXT;
ALTER TABLE users ADD COLUMN identity_verified_at TEXT;

ALTER TABLE device_commands ADD COLUMN sent_at TEXT;
ALTER TABLE device_commands ADD COLUMN acknowledged_at TEXT;
ALTER TABLE device_commands ADD COLUMN started_at TEXT;
ALTER TABLE device_commands ADD COLUMN error_message TEXT;
UPDATE device_commands SET status = CASE status WHEN 'PENDING' THEN 'QUEUED' WHEN 'DELIVERED' THEN 'SENT' WHEN 'SUCCEEDED' THEN 'SUCCESS' ELSE status END;
CREATE TRIGGER IF NOT EXISTS device_commands_default_queued
AFTER INSERT ON device_commands WHEN NEW.status = 'PENDING' BEGIN
  UPDATE device_commands SET status = 'QUEUED' WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','DATA_CLEAN','SYSTEM_RESET','CLIENT_CHECK','COMPLETED','FAILED')),
  description TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  vendor TEXT,
  invoice_url TEXT,
  technician TEXT,
  notes TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_device ON maintenance_records(device_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS order_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('EXTENSION','DEVICE_SWAP','PRICE_ADJUSTMENT','CANCELLATION','INVENTORY_RELEASE')),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_change_history_order ON order_change_history(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  allocation_type TEXT NOT NULL CHECK(allocation_type IN ('RENTAL','DEPOSIT','SERVICE_FEE','REFUND')),
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id, created_at);
CREATE TABLE IF NOT EXISTS refund_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  refund_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(refund_id, payment_id)
);
