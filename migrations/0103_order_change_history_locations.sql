-- 订单修改历史：扩展 change_type，允许记录取还地点变更 (TODO.md P1 #5 / 完善.md §34)
-- SQLite 无法直接修改 CHECK 约束，按标准流程重建表并保留既有数据。
ALTER TABLE order_change_history RENAME TO order_change_history_old;

CREATE TABLE order_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('EXTENSION','DEVICE_SWAP','PRICE_ADJUSTMENT','LOCATION_CHANGE','CANCELLATION','INVENTORY_RELEASE')),
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
