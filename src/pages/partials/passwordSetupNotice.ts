/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export function renderPasswordSetupNotice(status?: string): string {
  if (status === 'sent') return '<div data-flash-notice class="page-notification page-notification--success" role="status">账户已创建，设置密码邮件已发送。请用户在 24 小时内点击邮件中的链接设置登录密码。</div>'
  if (status === 'failed') return '<div data-flash-notice class="page-notification page-notification--error" role="alert">账户已创建，但设置密码邮件发送失败。请检查邮件服务配置，并让用户通过登录页的“忘记密码”重新申请设置密码链接。</div>'
  return ''
}
