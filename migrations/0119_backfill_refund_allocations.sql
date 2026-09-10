-- refund_allocations 行只由触发器产生：
--   payment_refunds_to_allocations             (0093) 仅 AFTER INSERT ... WHEN NEW.status='succeeded'
--   payment_refund_completion_to_allocations   (0100) 仅 AFTER UPDATE ... WHEN OLD.status='pending' AND NEW.status='succeeded'
-- 于是这些 succeeded 退款永远没有分配行，对账页永远把它们当成「账目异常」：
--   * 0093 之前就存在的退款
--   * 0100 之前就从 pending 翻成 succeeded 的退款（0100 只加触发器，没有回填历史）
--   * 走 processing -> succeeded 等两个触发器都不覆盖的状态转移
--
-- 本迁移：
--   1. 回填所有「已关联本单付款、且金额在该付款可退额度内」的孤儿退款。
--   2. 补一个更宽的完成触发器，覆盖任意 非succeeded -> succeeded 的 UPDATE。
--
-- 回填的 WHERE 复刻 refund_allocations_cannot_exceed_payment 守卫（严格 <=，不留容差）：
-- 只有当「该付款已登记分配 + 其全部未登记 succeeded 退款」合计不超过付款金额时才回填，
-- 保证逐行插入不会触发 RAISE(ABORT)；真正超退的付款一律跳过，继续由对账页标红。

INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
SELECT 'ra-' || lower(hex(randomblob(16))), pr.id, pr.payment_id, pr.refund_amount
FROM payment_refunds pr
JOIN payments p ON p.id = pr.payment_id
WHERE pr.status = 'succeeded'
  AND pr.payment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM refund_allocations ra WHERE ra.refund_id = pr.id)
  AND (
    COALESCE((SELECT SUM(ra2.amount) FROM refund_allocations ra2 WHERE ra2.payment_id = pr.payment_id), 0)
    + COALESCE((
        SELECT SUM(pr2.refund_amount) FROM payment_refunds pr2
        WHERE pr2.payment_id = pr.payment_id
          AND pr2.status = 'succeeded'
          AND NOT EXISTS (SELECT 1 FROM refund_allocations ra3 WHERE ra3.refund_id = pr2.id)
      ), 0)
  ) <= p.amount;

CREATE TRIGGER IF NOT EXISTS payment_refund_any_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status <> 'succeeded' AND NEW.payment_id IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;
