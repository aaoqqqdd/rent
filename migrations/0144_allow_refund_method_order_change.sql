-- 订单修改支持记录押金退款方式变更。
-- SQLite 无法直接修改 CHECK 约束，按标准流程重建表并保留既有数据。
ALTER TABLE order_change_history RENAME TO order_change_history_old;

CREATE TABLE order_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('EXTENSION','DEVICE_SWAP','PRICE_ADJUSTMENT','LOCATION_CHANGE','REFUND_METHOD','CANCELLATION','INVENTORY_RELEASE','COUPON_REVALIDATED')),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO order_change_history (id, order_id, change_type, before_json, after_json, reason, changed_by, created_at)
  SELECT id, order_id, change_type, before_json, after_json, reason, changed_by, created_at
  FROM order_change_history_old;

DROP TABLE order_change_history_old;

CREATE INDEX IF NOT EXISTS idx_order_change_history_order ON order_change_history(order_id, created_at DESC);
