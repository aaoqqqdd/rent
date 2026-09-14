-- 订单“已完成”只反映租赁流程本身（设备已归还），跟押金/退款是否真正结清是
-- 两回事：deposit_status 卡在 PENDING/HELD/REFUND_PENDING 时，订单列表和详情页
-- 之前只显示笼统的绿色“已完成”，掩盖了还有钱没处理完的事实（对应 o-af1VCjmW 那次事故）。
-- 新增一个独立的结算状态列，跟订单生命周期状态分开显示。
ALTER TABLE orders ADD COLUMN settlement_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
  CHECK(settlement_status IN ('NOT_APPLICABLE', 'PENDING', 'SETTLED'));

UPDATE orders SET settlement_status = CASE
  WHEN status != 'completed' THEN 'NOT_APPLICABLE'
  WHEN deposit_status IN ('PENDING', 'HELD', 'REFUND_PENDING') THEN 'PENDING'
  ELSE 'SETTLED'
END;

CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
