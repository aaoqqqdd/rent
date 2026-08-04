-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- 创建签约会话存储表，替换原内存存储
-- 用于在签约步骤之间持久化保存用户输入

CREATE TABLE IF NOT EXISTS sign_sessions (
    token TEXT PRIMARY KEY NOT NULL,
    contract_token TEXT NOT NULL,
    session_data TEXT NOT NULL, -- JSON存储会话数据
    expires_at TEXT NOT NULL, -- 过期时间
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_token) REFERENCES contracts(sign_token) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sign_sessions_expires_at ON sign_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sign_sessions_contract_token ON sign_sessions(contract_token);

-- 创建系统错误日志表，用于记录生产环境错误
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY NOT NULL,
    error_level TEXT NOT NULL CHECK(error_level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    context_data TEXT, -- JSON存储上下文信息
    user_id TEXT,
    request_url TEXT,
    request_method TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建索引用于错误日志查询
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(error_level);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
