-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- 为commission_records表添加驼峰命名字段，与代码保持一致
-- 同时保留原有的snake_case字段以保持向后兼容性

-- 为commission_records表添加驼峰命名字段
ALTER TABLE commission_records ADD COLUMN referrerId TEXT;
ALTER TABLE commission_records ADD COLUMN orderId TEXT;
ALTER TABLE commission_records ADD COLUMN userId TEXT;
ALTER TABLE commission_records ADD COLUMN createdAt TEXT;
ALTER TABLE commission_records ADD COLUMN updatedAt TEXT;

-- 将现有数据从snake_case字段复制到camelCase字段
UPDATE commission_records 
SET 
  referrerId = referrer_id,
  orderId = rental_id,
  userId = customer_id,
  createdAt = created_at,
  updatedAt = updated_at
WHERE referrerId IS NULL;

-- 创建外键约束
CREATE INDEX IF NOT EXISTS idx_commission_records_referrerId ON commission_records(referrerId);
CREATE INDEX IF NOT EXISTS idx_commission_records_orderId ON commission_records(orderId);
CREATE INDEX IF NOT EXISTS idx_commission_records_userId ON commission_records(userId);
