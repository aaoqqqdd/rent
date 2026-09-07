-- 优惠码残余缺口（设计文档/优惠码 §9 §15 §37 §38）
--
-- applicable_components：优惠可作用的费用组件（CSV）。默认仅 RENTAL_FEE，与现有
-- 行为一致；可加入 DELIVERY_FEE。押金 / 逾期费 / 损坏费永久排除，不在此列。
--
-- 每客户限次的并发防护改在应用层用条件 INSERT 完成（reserveCouponForOrder），
-- 不加库层唯一索引：SQLite 部分索引无法引用 coupons.max_uses_per_customer，
-- 一刀切索引会误伤 max_uses_per_customer > 1 或不限次的优惠码。
ALTER TABLE coupons ADD COLUMN applicable_components TEXT NOT NULL DEFAULT 'RENTAL_FEE';
