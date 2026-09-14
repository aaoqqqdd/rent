-- 回填历史订单缺失的 return_received_at。
--
-- 早期版本的 updateOrderStatus 把订单推进到 returned/completed 时只写了
-- rental_status，没有落 return_received_at，导致 RETURNED_ORDER_WITHOUT_RETURN_RECORD
-- 一致性校验长期报警（例如订单 o-R5SJp9-s）。代码已修复，此处补齐已有数据：
-- 优先用归还状态历史里的时间，其次订单更新时间，最后当前时间兜底。

UPDATE orders
SET return_received_at = COALESCE(
      return_received_at,
      (SELECT MAX(h.created_at)
         FROM rental_status_history h
        WHERE h.rental_id = orders.id
          AND h.new_status IN ('RETURNED', 'COMPLETED')),
      updatedAt,
      CURRENT_TIMESTAMP
    )
WHERE status IN ('returned', 'pending_return', 'completed')
  AND rental_status IN ('RETURNED', 'COMPLETED')
  AND return_received_at IS NULL;
