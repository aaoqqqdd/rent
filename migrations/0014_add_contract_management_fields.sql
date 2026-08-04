-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- 为contracts表添加合同管理所需的字段
-- 添加created_by字段记录合同创建人，用于权限控制
-- 添加deleted_at字段支持软删除，用于定期清理过期和已取消的合同

-- 添加created_by字段，记录创建合同的员工ID
ALTER TABLE contracts ADD COLUMN created_by TEXT REFERENCES users(id);

-- 添加deleted_at字段，标记合同是否已被删除（软删除）
ALTER TABLE contracts ADD COLUMN deleted_at TEXT;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON contracts(deleted_at);
