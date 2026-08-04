-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- 为contracts表添加签约相关字段，支持签约链接有效期功能
-- 添加sign_token字段用于签约链接唯一标识
-- 添加sign_valid_days字段存储链接有效期天数
-- 添加sign_expires_at字段存储具体的过期时间戳

ALTER TABLE contracts ADD COLUMN sign_token TEXT;
ALTER TABLE contracts ADD COLUMN sign_valid_days INTEGER DEFAULT 7;
ALTER TABLE contracts ADD COLUMN sign_expires_at TEXT;

-- 创建索引以提高查询性能
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_sign_token ON contracts(sign_token);
CREATE INDEX IF NOT EXISTS idx_contracts_sign_expires_at ON contracts(sign_expires_at);
