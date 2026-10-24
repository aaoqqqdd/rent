-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
--
-- 性能索引（orders / payments 相关）。与 0162_perf_indexes.sql 配套，
-- 必须在 0161_allow_rmb_order_payments 之后应用：0161 会重建 orders / payments
-- 两张表（DROP TABLE + RENAME），任何早于它的、指向这两张表的新索引都会被连带删除。
-- 只新增索引，不改表结构，全部 IF NOT EXISTS。
--
-- 列名全部按 orders / payments 的实际 schema（camelCase / snake_case 分别为）：
--   orders   —— userId、status、createdAt
--   payments —— customer_id、status

-- ---------------------------------------------------------------------------
-- 1) 员工「租赁订单」分页（/staff/orders）：
--    FROM orders o LEFT JOIN users u ON u.id = o.userId
--    WHERE u.staff_id = ? ORDER BY o.createdAt DESC, o.id DESC LIMIT ? OFFSET ?
--    旧实现整表读 orders 再在内存里按客户归属过滤；下推成 SQL 后需要
--    (userId, createdAt) 才能在「按客户过滤 + 按时间倒序」时仍走索引排序。
--    已有 idx_orders_userid(userId) 只覆盖第一列，排序仍要临时 B 树。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at ON orders(userId, createdAt DESC);

-- ---------------------------------------------------------------------------
-- 2) /staff/orders/ongoing 与 /admin 各列表的状态过滤 + 时间倒序：
--    WHERE o.status IN (...) ORDER BY o.createdAt DESC, o.id DESC
--    已有 idx_orders_status(status) 只能过滤；这条覆盖排序。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, createdAt DESC);

-- ---------------------------------------------------------------------------
-- 3) 批量客户风险分级（src/services/risk.ts → getCustomerRiskLevels，服务于 /admin/users）：
--    SELECT ... FROM payments WHERE customer_id IN (...) GROUP BY customer_id
--    payments 之前只在 payment_provider / rental_id 上有索引，按客户聚合要全表扫。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_customer_status ON payments(customer_id, status);
