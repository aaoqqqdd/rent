/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { sendTransactionalEmail } from '../notifyChannels'
import { escapeHtml, renderEmailNotificationHtml } from '../lib/html'

// 初次设置密码和忘记密码共用一次性令牌与设置页面；数据库只保存摘要。
export async function sendPasswordResetEmail(c: Context, user: { id: string; name?: string; email: string }, purpose: 'setup' | 'reset' = 'reset'): Promise<boolean> {
  const token = nanoid(48)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').bind(user.id),
    c.env.RENT.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', ?))").bind(`reset-${nanoid(12)}`, user.id, tokenHash, purpose === 'setup' ? '+24 hours' : '+30 minutes'),
  ])
  const url = `${new URL(c.req.url).origin}/reset-password?token=${encodeURIComponent(token)}`
  const subject = purpose === 'setup' ? '设置您的登录密码 - PC Rental' : '重置您的登录密码 - PC Rental'
  const validity = purpose === 'setup' ? '24 小时' : '30 分钟'
  const result = await sendTransactionalEmail(c, {
    to: user.email,
    subject,
    html: renderEmailNotificationHtml(subject, `<p>您好 ${escapeHtml(user.name || '')}，${purpose === 'setup' ? '您的账户已创建。' : ''}请在 ${validity}内点击以下链接${purpose === 'setup' ? '设置' : '重置'}登录密码：</p><p><a href="${escapeHtml(url)}">${purpose === 'setup' ? '设置' : '重置'}登录密码</a></p><p>如无法点击链接，请复制以下地址到浏览器：<br>${escapeHtml(url)}</p><p>如果链接已过期，请在登录页点击“忘记密码”重新申请。</p>`),
    text: purpose === 'setup'
      ? `您好 ${user.name || ''}，您的账户已创建。请在 24 小时内打开以下链接设置登录密码：\n${url}\n设置完成后即可使用您的邮箱登录。如果链接已过期，请在登录页点击“忘记密码”重新申请。`
      : `您好 ${user.name || ''}，请在 30 分钟内打开以下链接重置密码：\n${url}`,
  })
  return result.ok
}
