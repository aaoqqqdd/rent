-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 配送记录由营销官网的配送 Worker 写入，主应用管理员页面读取并管理。
-- 使用 IF NOT EXISTS 兼容官网已经按需创建过表的数据库。
CREATE TABLE IF NOT EXISTS delivery_bookings (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('outbound', 'return')),
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  purchase_order_number TEXT NOT NULL UNIQUE,
  tracking_url TEXT,
  status TEXT NOT NULL,
  price REAL,
  proof_of_delivery_url TEXT,
  signature_url TEXT,
  provider_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_bookings_order_direction
  ON delivery_bookings(order_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_bookings_status
  ON delivery_bookings(status, updated_at DESC);
