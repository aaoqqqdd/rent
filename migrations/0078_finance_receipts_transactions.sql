-- Finance model from 设计文档/收据.
-- Keep payments/payment_refunds for compatibility; these tables are the
-- normalized accounting records used by receipts and future refunds.
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_number TEXT NOT NULL UNIQUE,
  order_id TEXT,
  customer_id TEXT,
  invoice_id TEXT,
  transaction_type TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider TEXT,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  description TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status, created_at);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  invoice_id TEXT,
  customer_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  subtotal REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  deposit_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_paid REAL NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'issued',
  document_url TEXT,
  document_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_order ON receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customer_id, issued_at);

CREATE TABLE IF NOT EXISTS receipt_transactions (
  receipt_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  PRIMARY KEY (receipt_id, transaction_id)
);
