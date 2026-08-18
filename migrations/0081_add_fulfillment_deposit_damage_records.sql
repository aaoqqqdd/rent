CREATE TABLE IF NOT EXISTS order_fulfillment_records (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK(record_type IN ('HANDOVER', 'RETURN')),
  device_serial_number TEXT NOT NULL,
  accessories_json TEXT NOT NULL DEFAULT '[]',
  condition_snapshot_json TEXT NOT NULL DEFAULT '{}',
  customer_confirmed INTEGER NOT NULL DEFAULT 0,
  customer_confirmation_name TEXT,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_fulfillment_once
  ON order_fulfillment_records(order_id, record_type);

CREATE TABLE IF NOT EXISTS damage_cases (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_urls TEXT NOT NULL DEFAULT '',
  liability_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(liability_status IN ('PENDING', 'CUSTOMER', 'WAIVED', 'DISPUTED')),
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  final_cost_cents INTEGER,
  repair_invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'QUOTED', 'DISPUTED', 'RESOLVED', 'WAIVED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_damage_cases_order ON damage_cases(order_id, status, created_at DESC);
