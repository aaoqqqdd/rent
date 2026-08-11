CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES
('order_pending_payment', '订单待付款', '您的订单待付款 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 正等待付款。'),
('contract_pending_sign', '合同待签署', '请签署租赁合同 - {contract_number}', '您好 {customer_name}，请通过以下链接签署租赁合同：{sign_url}'),
('payment_completed', '付款完成', '付款已完成 - {order_number}', '您的订单 {order_number} 已完成付款。'),
('return_reminder', '归还提醒', '设备归还提醒 - {order_number}', '您的设备租赁即将到期，请按预约时间归还设备。'),
('refund_completed', '退款完成', '退款已处理 - {order_number}', '您的订单 {order_number} 已完成退款，退款金额：{refund_amount}。');
