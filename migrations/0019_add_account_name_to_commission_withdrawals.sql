-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 添加账户名称字段到佣金提现记录表，支持银行转账功能
ALTER TABLE commission_withdrawals ADD COLUMN account_name TEXT;
