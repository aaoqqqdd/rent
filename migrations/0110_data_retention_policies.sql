-- 完善.md §25 / §37（及 P3 #18）— 数据保留策略。
-- 每类数据一条策略：保留天数、法律 / 运营依据、到期动作（归档 / 删除 / 匿名化）、是否启用。
-- 本表只定义与展示策略；到期数据的实际清理由后续调度任务执行（§26 / §30 / P4）。
CREATE TABLE IF NOT EXISTS data_retention_policies (
  category TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  basis TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'ARCHIVE' CHECK(action IN ('ARCHIVE','DELETE','ANONYMISE','RETAIN')),
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO data_retention_policies (category, label, retention_days, basis, action, enabled, notes) VALUES
  ('CONTRACTS',        '租赁合同与签署快照', 2555, '税务 / 合同法：结束后保留 7 年', 'RETAIN',    1, '合同为不可变历史记录，仅归档不删除'),
  ('FINANCIAL_RECORDS','付款 / 退款 / 押金 / Ledger', 2555, '澳洲税法：交易记录保留 7 年', 'RETAIN',   1, '财务记录必须保留，不做删除或匿名化'),
  ('IDENTITY_DOCUMENTS','身份证件号与验证材料', 365, '最小必要原则：验证完成后 12 个月', 'ANONYMISE', 1, '仅保留“已验证”事实与末四位，抹去完整证件号'),
  ('DEVICE_LOGS',      '设备客户端 / 远程命令日志', 540, '运营排障：18 个月', 'DELETE',      1, ''),
  ('REFERRAL_RECORDS', '推荐关系与奖励台账', 1095, '风控 / 反滥用：3 年', 'ARCHIVE',       1, ''),
  ('COUPON_RECORDS',   '优惠码发放与核销记录', 1095, '财务对账 / 反滥用：3 年', 'ARCHIVE',    1, ''),
  ('AUDIT_LOGS',       '审计日志', 2555, '合规审计：高风险操作保留 7 年', 'RETAIN',        1, '审计日志禁止 UPDATE / DELETE'),
  ('SUPPORT_RECORDS',  '客服工单与沟通记录', 730, '服务质量 / 争议举证：2 年', 'DELETE',      1, ''),
  ('INACTIVE_CUSTOMER_PII','长期不活跃客户的非必要个人资料', 1095, '最小必要原则：末次活动后 3 年', 'ANONYMISE', 1, '保留账户 ID 与财务 / 合同关联，抹去姓名 / 电话 / 地址');
