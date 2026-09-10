-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 统一《用户协议》与其它法律文档的版本行模板变量名。
--
-- 迁移 0114 为 userTerms 植入的版本行用的是 {user_agreement_version} /
-- {user_agreement_last_updated_date}，而 serviceTerms / privacyPolicy /
-- copyrightNotice / cookiePolicy 等全部使用与公开页面 varPrefix 一致的
-- {<prefix>_version} 形式（如 {service_terms_version}）。这是《用户协议》
-- 与「其它协议」渲染口径不一致的唯一来源。
--
-- 这里把已入库的 userTerms 内容里的旧变量名规范化为 {user_terms_version} /
-- {user_terms_last_updated_date}。代码侧仍保留旧名作为别名，故管理员若已自定义
-- 过内容也不会因此显示原始占位符。仅当内容确实还带旧变量名时才更新。

UPDATE systemSettings
SET value = REPLACE(
      REPLACE(value, '{user_agreement_last_updated_date}', '{user_terms_last_updated_date}'),
      '{user_agreement_version}', '{user_terms_version}'
    ),
    updatedAt = CURRENT_TIMESTAMP
WHERE key = 'userTerms'
  AND value LIKE '%{user_agreement_version}%';
