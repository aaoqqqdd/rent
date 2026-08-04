CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('invoice', 'credit_note')),
  subtotal REAL NOT NULL,
  gst_amount REAL NOT NULL,
  deposit_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL,
  related_invoice_id TEXT,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(related_invoice_id) REFERENCES invoices(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_order_type ON invoices(order_id, type);

