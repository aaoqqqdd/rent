-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 系统健康监控历史（完善.md P8 #32）。
-- runMonitoringSweep 每次执行给每个指标写一行；/admin/monitoring 据此画趋势与「首次异常时间」。
-- 保留窗口由 sweep 自身清理（默认 30 天），无需单独的清理任务。
CREATE TABLE IF NOT EXISTS monitoring_metric_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metric_key TEXT NOT NULL,
  numerator INTEGER NOT NULL DEFAULT 0,
  denominator INTEGER NOT NULL DEFAULT 0,
  rate REAL NOT NULL DEFAULT 0,
  level TEXT NOT NULL CHECK(level IN ('OK', 'WARN', 'CRITICAL'))
);
CREATE INDEX IF NOT EXISTS idx_mms_key_time ON monitoring_metric_snapshots(metric_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_mms_time ON monitoring_metric_snapshots(captured_at DESC);
