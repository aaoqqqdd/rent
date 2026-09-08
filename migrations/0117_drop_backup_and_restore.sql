-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 移除「备份与恢复」台账（原 0112）。灾备改为完全依赖 Cloudflare D1 Time Travel（30 天回滚），
-- 不再维护站内的 RPO / RTO 策略、备份执行记录与恢复演练日志。
DROP TABLE IF EXISTS restore_tests;
DROP TABLE IF EXISTS backup_runs;
DROP TABLE IF EXISTS backup_policy;
