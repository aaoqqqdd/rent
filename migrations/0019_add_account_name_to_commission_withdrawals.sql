-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- 添加账户名称字段到佣金提现记录表，支持银行转账功能
ALTER TABLE commission_withdrawals ADD COLUMN account_name TEXT;
