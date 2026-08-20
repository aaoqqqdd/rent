CREATE TABLE IF NOT EXISTS anomalous_order_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  consistency_issue_id TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  original_status TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESTORED','CONFIRMED')),
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  UNIQUE(consistency_issue_id)
);
CREATE INDEX IF NOT EXISTS idx_anomalous_order_reviews_status ON anomalous_order_reviews(status, detected_at);
