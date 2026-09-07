-- P7 通用 webhook 幂等表：Stripe / 设备回调 / 未来第三方服务共用。
-- provider + event_id 唯一；同一事件只允许产生一次业务副作用。
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','PROCESSED','FAILED')),
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status, received_at);

-- P1.3 远程命令：可选幂等键，防止管理员重复点击/客户端重放创建重复命令。
-- 普通 UNIQUE 索引即可：SQLite 允许多行 NULL 键，且 ON CONFLICT(idempotency_key)
-- 需要一个非部分 UNIQUE 索引作为冲突目标（D1 不支持以部分索引为 upsert 目标）。
ALTER TABLE device_commands ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_commands_idempotency
  ON device_commands(idempotency_key);

-- 修复 0074 迁移遗留的悬空外键：ALTER TABLE ... RENAME 时 SQLite 会改写其它表
-- 指向它的外键，0074 把 device_commands 改名后又 DROP 了临时表，导致
-- device_command_results.command_id 外键指向不存在的 device_commands_legacy，
-- 在启用外键校验的运行时上任何写入都会报 "no such table"。重建为无外键版本，
-- 与本项目较新的表（0092/0096 等）保持一致。
ALTER TABLE device_command_results RENAME TO device_command_results_old;
CREATE TABLE device_command_results (
  id TEXT PRIMARY KEY NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  result_code TEXT NOT NULL,
  result_message TEXT,
  executed_at TEXT NOT NULL,
  reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO device_command_results (id, command_id, device_id, success, result_code, result_message, executed_at, reported_at)
  SELECT id, command_id, device_id, success, result_code, result_message, executed_at, reported_at FROM device_command_results_old;
DROP TABLE device_command_results_old;
