-- 「订单审核通过」没有业务事件触发，且与网站订单审核后的实际付款流程重复。
DELETE FROM email_templates WHERE id = 'order_approved';
