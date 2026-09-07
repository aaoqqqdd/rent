-- 完善.md §26 / §39（P4 #19、#20）— 备份与恢复。
-- backup_policy：单行配置，记录 RPO / RTO 目标与最近一次恢复演练。
-- backup_runs：每次备份 / 导出的执行记录（范围、行数、校验和、操作人）。
-- restore_tests：恢复演练记录（范围、是否成功、耗时、说明）。
CREATE TABLE IF NOT EXISTS backup_policy (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  rpo_minutes INTEGER NOT NULL DEFAULT 1440,
  rto_minutes INTEGER NOT NULL DEFAULT 240,
  schedule_note TEXT NOT NULL DEFAULT 'D1 Time Travel（30 天）+ 每日 /admin/backup/export.json 离线快照',
  scope_note TEXT NOT NULL DEFAULT '数据库、合同快照 / PDF、Receipt、Credit Note、Audit Log',
  last_restore_test_at TEXT,
  last_restore_test_note TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO backup_policy (id) VALUES (1);

CREATE TABLE IF NOT EXISTS backup_runs (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS','FAILED')),
  row_counts_json TEXT NOT NULL DEFAULT '{}',
  checksum TEXT,
  byte_size INTEGER,
  failure_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backup_runs_created ON backup_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS restore_tests (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('PASS','FAIL')),
  duration_minutes INTEGER,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_restore_tests_created ON restore_tests(created_at DESC);
