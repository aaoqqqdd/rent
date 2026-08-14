CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_templates (id, name, subject, body)
VALUES (
  'agreement_update',
  '协议更新通知',
  '协议内容已更新 - {company_name}',
  '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请登录后查看最新版本。'
);
