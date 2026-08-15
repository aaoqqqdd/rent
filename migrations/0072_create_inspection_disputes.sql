CREATE TABLE IF NOT EXISTS inspection_disputes (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inspection_disputes_order ON inspection_disputes(order_id, created_at DESC);
