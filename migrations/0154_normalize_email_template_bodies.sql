-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 系统通知模板只保存正文片段；邮件外壳、品牌头部和统一页脚由
-- renderEmailNotificationHtml 负责生成。营销活动模板位于另一张表，不在本迁移范围内。

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

-- 如果历史数据中保存过完整 HTML 邮件，先提取 <body> 内的正文。
UPDATE email_templates
SET body = trim(
  CASE
    WHEN instr(lower(body), '<body') > 0 AND instr(lower(body), '</body>') > 0 THEN
      substr(
        body,
        instr(lower(body), '<body') + instr(substr(lower(body), instr(lower(body), '<body')), '>'),
        instr(lower(body), '</body>') - (
          instr(lower(body), '<body') + instr(substr(lower(body), instr(lower(body), '<body')), '>')
        )
      )
    ELSE body
  END
), format = 'html', updated_at = CURRENT_TIMESTAMP;

-- 统一页脚属于邮件壳，不应继续保存在正文中。
UPDATE email_templates
SET body = trim(
  CASE
    WHEN instr(body, '<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">') > 0 THEN
      substr(body, 1, instr(body, '<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">') - 1)
    ELSE body
  END
), format = 'html', updated_at = CURRENT_TIMESTAMP;

-- 清理旧版没有分隔线的签名行。
UPDATE email_templates
SET body = trim(replace(replace(body,
  '<p><strong>{company_name}</strong><br>{company_email}</p>',
  ''),
  '<p>{company_name}｜{company_address}｜{company_email}</p>',
  '')),
  format = 'html', updated_at = CURRENT_TIMESTAMP;
