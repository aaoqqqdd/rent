CREATE TABLE IF NOT EXISTS order_time_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  previous_pickup_slot TEXT,
  previous_return_slot TEXT,
  pickup_slot TEXT NOT NULL,
  return_slot TEXT NOT NULL,
  additional_service_fee REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_time_changes_order ON order_time_change_history(order_id, created_at DESC);
