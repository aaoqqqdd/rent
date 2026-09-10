-- 保存申请阶段由 Stripe SetupIntent 验证后的支付方式引用。
-- 不保存卡号、有效期或安全码；正式扣款仍只在订单确认后创建 PaymentIntent。
ALTER TABLE orders ADD COLUMN stripe_payment_method_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_setup_intent_id TEXT;
