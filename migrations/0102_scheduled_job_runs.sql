CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id TEXT PRIMARY KEY NOT NULL,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  result_summary TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job_started ON scheduled_job_runs(job_name, started_at DESC);
