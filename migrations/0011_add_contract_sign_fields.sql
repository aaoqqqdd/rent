-- 为contracts表添加签约相关字段，支持签约链接有效期功能
-- 添加sign_token字段用于签约链接唯一标识
-- 添加sign_valid_days字段存储链接有效期天数
-- 添加sign_expires_at字段存储具体的过期时间戳

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_token TEXT UNIQUE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_valid_days INTEGER DEFAULT 7;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_expires_at TEXT;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_contracts_sign_token ON contracts(sign_token);
CREATE INDEX IF NOT EXISTS idx_contracts_sign_expires_at ON contracts(sign_expires_at);