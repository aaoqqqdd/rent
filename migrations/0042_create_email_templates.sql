CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  format TEXT NOT NULL DEFAULT 'markdown',
  theme_color TEXT NOT NULL DEFAULT '#f0a35b'
);
INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES
('order_pending_payment', '订单待付款', '您的订单待付款 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 正等待付款。'),
('contract_pending_sign', '合同待签署', '请签署租赁合同 - {contract_number}', '您好 {customer_name}，请通过以下链接签署租赁合同：{sign_url}'),
('payment_completed', '付款完成', '付款已完成 - {order_number}', '您的订单 {order_number} 已完成付款。'),
('return_reminder', '归还提醒', '设备归还提醒 - {order_number}', '您的设备租赁即将到期，请按预约时间归还设备。'),
('refund_completed', '退款完成', '退款已处理 - {order_number}', '您的订单 {order_number} 已完成退款，退款金额：{refund_amount}。');
INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES
('order_created', '订单已创建', '订单已创建 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 已创建。设备：{device_name}，租期：{start_date} 至 {end_date}。订单金额：{total_amount}。'),
('order_approved', '订单审核通过', '订单审核通过 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 已审核通过。请在 {payment_due_date} 前完成付款。'),
('payment_reminder', '付款提醒', '付款提醒 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}。'),
('pickup_reminder', '取件提醒', '取件提醒 - {order_number}', '您好 {customer_name}，请于 {pickup_date} 到 {pickup_location} 取件。设备：{device_name}。'),
('return_confirmed', '归还确认', '设备归还确认 - {order_number}', '您好 {customer_name}，我们已确认收到订单 {order_number} 的设备。感谢您的使用！'),
('password_reset', '密码重置', '重置您的登录密码', '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}');
