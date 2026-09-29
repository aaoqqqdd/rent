-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 站内通知与邮件使用独立的模板副本：标题和正文可分别维护，站内展示时不套用邮件外壳。
CREATE TABLE IF NOT EXISTS in_app_notification_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 首次创建时以现有邮件模板的内容为初始值。之后两个模板库互不影响。
INSERT OR IGNORE INTO in_app_notification_templates (id, name, title, message, enabled, updated_at)
SELECT id, name, subject, body, enabled, updated_at
FROM email_templates;
