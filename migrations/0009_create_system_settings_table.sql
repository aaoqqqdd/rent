-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

CREATE TABLE IF NOT EXISTS systemSettings (
    key TEXT PRIMARY KEY,
    value TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认系统设置
INSERT INTO systemSettings (key, value) VALUES 
('rentalTerms', '<h1>电脑租赁协议</h1><p>本协议由以下双方签订：</p>'),
('priceStrategy', '标准定价：按日租金计费，超过租期按日累加。'),
('paymentMethods', '{"square": true, "bankTransfer": true, "balancePayment": true}'),
('bankDetails', '{"bsb": "062-001", "account": "87654321", "accountName": "账户名"}'),
('emailTemplate', '<p>您好，{{user_name}}！您的订单{{order_no}}已创建成功。</p>'),
('referralSettings', '{"defaultRate": 10, "levelLimit": 3, "settlementPeriod": 30}')
ON CONFLICT(key) DO NOTHING;
