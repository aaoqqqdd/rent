-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

CREATE TABLE IF NOT EXISTS contract_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO contract_templates (id, name, content)
VALUES ('default', '标准租赁合同模板', '<h1>电脑租赁协议</h1><p>本协议由以下双方于 {{date}} 签订：</p><p><strong>出租方：</strong> 电脑租赁公司</p><p><strong>承租方：</strong> {{customerName}}</p><h2>租赁设备</h2><p><strong>设备名称：</strong> {{deviceName}}</p><p><strong>型号：</strong> {{deviceModel}}</p><p><strong>序列号：</strong> {{deviceSerialNumber}}</p><h2>租赁期限</h2><p><strong>起始日期：</strong> {{startDate}}</p><p><strong>结束日期：</strong> {{endDate}}</p><h2>租金与押金</h2><p><strong>日租金：</strong> {{dailyRate}} 元</p><p><strong>总租金：</strong> {{totalRent}} 元</p><p><strong>押金：</strong> {{depositAmount}} 元</p><p><strong>总计：</strong> {{totalAmount}} 元</p>')
ON CONFLICT(id) DO NOTHING;
