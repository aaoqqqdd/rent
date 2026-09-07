-- 完善.md §21 / TODO.md P2 #9 — Chargeback 关联设备 + 风险标记，并补齐 Stripe 结案的真实财务影响入口。
-- payment_disputes 已在 0101 建表（stripe_dispute_id / payment_id / order_id / customer_id /
-- amount / currency / reason / status / evidence_due_by / evidence_status / result / financial_impact）。
-- 这里补两列：把争议关联到具体设备，并记录 Chargeback 自动生成的 CHARGEBACK 风险标记。

ALTER TABLE payment_disputes ADD COLUMN device_id TEXT;
ALTER TABLE payment_disputes ADD COLUMN risk_flag_id TEXT;

-- 历史争议按订单回填设备（orders 使用 camelCase 列名 deviceId）。
UPDATE payment_disputes
SET device_id = (SELECT o.deviceId FROM orders o WHERE o.id = payment_disputes.order_id)
WHERE device_id IS NULL AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_disputes_device ON payment_disputes(device_id);
