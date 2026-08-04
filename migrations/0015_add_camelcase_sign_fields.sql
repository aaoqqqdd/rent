-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 为contracts表添加驼峰格式的签约字段，与代码保持一致
-- 添加signExpiresAt字段以支持代码中的驼峰命名约定
-- 同时保留原有的snake_case字段以保持向后兼容性

ALTER TABLE contracts ADD COLUMN signExpiresAt TEXT;
ALTER TABLE contracts ADD COLUMN signValidDays INTEGER DEFAULT 7;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_contracts_sign_expires_at_camel ON contracts(signExpiresAt);
