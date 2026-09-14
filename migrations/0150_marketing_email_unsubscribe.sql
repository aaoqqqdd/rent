-- 营销邮件退订：每位客户一个持久的退订开关；退订令牌挂在具体某次群发的收件人行上
-- （复用 0149 建的 marketing_campaign_recipients，而不是新建一张令牌表），无需登录即可退订。
ALTER TABLE users ADD COLUMN marketing_email_opt_out INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN marketing_opt_out_at TEXT;

ALTER TABLE marketing_campaign_recipients ADD COLUMN unsubscribe_token TEXT;
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_unsubscribe_token ON marketing_campaign_recipients(unsubscribe_token);
