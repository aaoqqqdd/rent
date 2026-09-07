-- 完善.md §29（P2）/ §49 Phase 4 — Agent Program 预留。
-- 仅建表 + 特性开关，不接入下单 / 结算 / 佣金流程。启用属于后续独立开发项。
-- 与既有一次性“推荐奖励”(referral_rewards) 区分：Agent 是长期分销 / 代理关系。

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK(tier IN ('STANDARD','SILVER','GOLD')),
  commission_rate REAL NOT NULL DEFAULT 0 CHECK(commission_rate >= 0 AND commission_rate <= 1),
  max_commission_per_order REAL,
  status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK(status IN ('INACTIVE','ACTIVE','SUSPENDED','TERMINATED')),
  agreement_signed_at TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_attributions (
  id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  commission_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','PAID','REVERSED','REJECTED')),
  rule_snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
CREATE INDEX IF NOT EXISTS idx_agent_attributions_agent ON agent_attributions(agent_id, status);

-- 特性开关：默认关闭。启用前所有 Agent 相关入口只读且显式提示“未启用”。
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('agent_program', 0, 'Agent / 分销代理计划（完善.md §29，预留未启用）');
