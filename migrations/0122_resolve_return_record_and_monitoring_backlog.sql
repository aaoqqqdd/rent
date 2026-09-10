-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 清理「异常任务积压」告警堆积。背景：
--   1. 少量历史订单已归还结算（status/rental_status 为 RETURNED/COMPLETED），但 return_received_at
--      为空（早于 0075 的归还收据流程），被 RETURNED_ORDER_WITHOUT_RETURN_RECORD 一致性检查持续命中。
--   2. open_exception_backlog 指标此前把 runMonitoringSweep 自己写入的 MONITORING_ALERT 行也算进积压，
--      于是指标一旦 CRITICAL 就每天再生成一条 MONITORING_ALERT，无法自愈（代码侧已修）。
-- 本迁移把历史数据补齐，并关闭因上述循环产生的陈旧告警行。

-- 1) 用最可靠的时间回填 return_received_at：优先归还履约记录，其次归还验机记录，最后订单更新时间。
UPDATE orders
SET return_received_at = COALESCE(
      (SELECT MIN(recorded_at) FROM order_fulfillment_records
        WHERE order_id = orders.id AND record_type = 'RETURN'),
      (SELECT MIN(created_at) FROM device_inspections
        WHERE rental_id = orders.id AND inspection_type = 'after_return'),
      updatedAt,
      CURRENT_TIMESTAMP
    )
WHERE status IN ('returned', 'completed')
  AND rental_status IN ('RETURNED', 'COMPLETED')
  AND return_received_at IS NULL;

-- 2) 关闭已经不再成立的 RETURNED_ORDER_WITHOUT_RETURN_RECORD 异常行。
UPDATE data_consistency_issues
SET resolved_at = CURRENT_TIMESTAMP
WHERE issue_type = 'RETURNED_ORDER_WITHOUT_RETURN_RECORD'
  AND resolved_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = data_consistency_issues.entity_id
      AND o.status IN ('returned', 'pending_return', 'completed')
      AND o.rental_status IN ('RETURNED', 'COMPLETED')
      AND o.return_received_at IS NULL
  );

-- 3) 关闭 open_exception_backlog 反馈循环期间堆积的陈旧监控告警行。
--    若指标当前仍 CRITICAL，下一次 runMonitoringSweep 会按当天重新登记一条。
UPDATE data_consistency_issues
SET resolved_at = CURRENT_TIMESTAMP
WHERE issue_type = 'MONITORING_ALERT'
  AND entity_type = 'METRIC'
  AND entity_id LIKE 'open_exception_backlog:%'
  AND resolved_at IS NULL;
