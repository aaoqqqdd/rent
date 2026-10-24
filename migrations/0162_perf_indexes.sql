-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
--
-- 性能索引（user / 审核 / 提现相关）：只为「列表页下推分页 / 批量风险分级」里
-- 实际用到的过滤与排序列补索引。只新增索引，不改任何表结构，也不改历史迁移文件。
-- 全部使用 IF NOT EXISTS，重复执行安全。
--
-- ⚠ 列名大小写陷阱（仓库里混用，逐条按实际 schema 核对过）：
--   * users   —— 时间列 / 外键列是 snake_case：created_at、staff_id、referrer_id
--   * orders  —— 时间列 / 外键列是 camelCase：createdAt、userId、status、deviceId
--   * payments —— customer_id、status、created_at（snake_case）
--   改这个文件前请先 `PRAGMA table_info(<table>)` 确认。
--
-- ⚠ orders / payments 上的新索引放在 0163_perf_indexes_orders.sql：
--   0161_allow_rmb_order_payments 为了放宽 CHECK 约束会重建这两张表
--   （CREATE *_rmb_new → DROP 旧表 → RENAME → 手工恢复索引），既有测试
--   「RMB migration preserves existing records, indexes and payment safeguards」
--   会「只重放 0161」并比对索引集合。把依赖这两张表的新索引留在这条之后
--   （0162 早于 0161 应用）会让该断言在语义上无法成立，因此拆到 0163。

-- ---------------------------------------------------------------------------
-- 1) /staff/customers、/admin/users、/admin/orders 的客户下拉框
--    SELECT ... FROM users WHERE role = 'CUSTOMER' ORDER BY name
--    以及收件人筛选、营销受众统计等按角色取人的查询。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role_name ON users(role, name);

-- ---------------------------------------------------------------------------
-- 2) /staff/customers 与 /admin/users 的分页排序：
--    WHERE role = 'CUSTOMER' [AND staff_id = ?] ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
--    已有 idx_users_staff_id(staff_id, role) 能过滤但无法给排序；这条覆盖排序。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users(role, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) /admin/finance/anomalous-orders 分页：
--    ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END, detected_at DESC LIMIT ? OFFSET ?
--    已有 idx_anomalous_order_reviews_status(status, detected_at) 覆盖 status 前导；
--    这条补「状态 + 时间倒序」的第二段排序，避免对历史全表排序。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_anomalous_order_reviews_detected ON anomalous_order_reviews(status, detected_at DESC);

-- ---------------------------------------------------------------------------
-- 4) /admin/withdrawals（佣金提现审核）目前是全表读 + 内存统计：
--    ORDER BY requested_at DESC；按 status 统计待处理/已完成/未完成。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status_requested ON commission_withdrawals(status, requested_at DESC);
