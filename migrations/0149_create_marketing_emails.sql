-- 营销邮件：独立于事务性通知模板的营销模板库 + 群发记录，支持共享优惠码或
-- 为每位收件人生成专属一次性优惠码（复用 coupons 表，max_uses = 1 即为唯一码）。
CREATE TABLE IF NOT EXISTS marketing_email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  theme_color TEXT NOT NULL DEFAULT '#f0a35b',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  theme_color TEXT NOT NULL DEFAULT '#f0a35b',
  coupon_mode TEXT NOT NULL DEFAULT 'none' CHECK(coupon_mode IN ('none','shared','unique')),
  coupon_id TEXT,
  unique_discount_type TEXT CHECK(unique_discount_type IN ('percent','fixed') OR unique_discount_type IS NULL),
  unique_discount_value REAL,
  unique_max_discount_amount REAL,
  unique_expires_at TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SENDING' CHECK(status IN ('SENDING','SENT','FAILED')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at ON marketing_campaigns(created_at);

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  email TEXT NOT NULL,
  coupon_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED')),
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign ON marketing_campaign_recipients(campaign_id);
