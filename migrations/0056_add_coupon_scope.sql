ALTER TABLE coupons ADD COLUMN device_id TEXT;
ALTER TABLE coupons ADD COLUMN brand TEXT;
ALTER TABLE coupons ADD COLUMN config_keyword TEXT;

CREATE INDEX IF NOT EXISTS idx_coupons_device_id ON coupons(device_id);
CREATE INDEX IF NOT EXISTS idx_coupons_brand ON coupons(brand);
