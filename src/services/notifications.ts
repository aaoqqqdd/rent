/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 站内通知 + 若干由 cron 触发的通知 / 邮件投递任务。
// 依赖 settings（公司信息、发件人）与 lib/html（邮件模板）。

import type { Context } from 'hono'
import { renderEmailNotificationHtml } from '../lib/html'
import { getSystemSettings } from '../settings/systemSettings'
import { resolveResendCredentials, dispatchChannelAlert } from '../notifyChannels'

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'STAFF'])

// 判断某个收件人是不是员工/管理员（结果按请求缓存）。用于决定这条通知
// 是否要同时广播到 Telegram / Server酱 / Webhook 等推送渠道——客户的站内信
// 不会往管理员的推送渠道里灌。
async function isStaffRecipient(c: Context, recipientId: string): Promise<boolean> {
  const cache: Map<string, boolean> = (c as any).__recipientRoleCache ||= new Map()
  if (cache.has(recipientId)) return cache.get(recipientId)!
  let staff = false
  try {
    const row = await c.env.RENT.prepare('SELECT role FROM users WHERE id = ?').bind(recipientId).first() as any
    staff = STAFF_ROLES.has(String(row?.role || '').toUpperCase())
  } catch { staff = false }
  cache.set(recipientId, staff)
  return staff
}

let notificationsSchemaReady: Promise<void> | null = null

export async function ensureNotificationsTable(c: Context): Promise<void> {
  if (!notificationsSchemaReady) notificationsSchemaReady = (async () => {
    await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    order_id TEXT,
    sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    read_at TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN sender_id TEXT REFERENCES users(id) ON DELETE SET NULL').run() } catch (_) { /* column already exists */ }
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN deleted_at TEXT').run() } catch (_) { /* column already exists */ }
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, read_at, created_at DESC)').run()
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_sender_created ON notifications(sender_id, deleted_at, created_at DESC)').run()
  })()
  try { await notificationsSchemaReady } catch (error) { notificationsSchemaReady = null; throw error }
}

export async function createNotification(c: Context, notification: { recipientId: string; type: string; title: string; message: string; orderId?: string; senderId?: string }): Promise<void> {
  await ensureNotificationsTable(c)
  const id = `nt-${crypto.randomUUID()}`
  await c.env.RENT.prepare('INSERT INTO notifications (id, recipient_id, type, title, message, order_id, sender_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, notification.recipientId, notification.type, notification.title, notification.message, notification.orderId || null, notification.senderId || null).run()

  // 员工/管理员收到的通知同步广播到已启用的推送渠道；尽力而为，绝不影响站内信。
  try {
    if (await isStaffRecipient(c, notification.recipientId)) {
      const url = notification.orderId ? new URL(`/admin/orders/${notification.orderId}`, c.req.url).toString() : undefined
      await dispatchChannelAlert(c, { title: notification.title, message: notification.message, url })
    }
  } catch (error: any) {
    console.error('dispatchChannelAlert failed:', error?.message || error)
  }
}

export async function getNotifications(c: Context, recipientId: string): Promise<any[]> {
  await ensureNotificationsTable(c)
  const result = await c.env.RENT.prepare('SELECT * FROM notifications WHERE recipient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100').bind(recipientId).all()
  return result.results || []
}

export async function createDueDateNotifications(c: Context): Promise<number> {
  await ensureNotificationsTable(c)
  const today = new Date()
  const notices = [
    { days: 3, type: 'due_soon_3d', title: '租赁即将到期', text: '您的设备租赁将在 3 天后到期，请提前安排归还或联系工作人员续租。' },
    { days: 0, type: 'due_today', title: '租赁今日到期', text: '您的设备租赁今天到期，请尽快归还设备并等待验机。' },
  ]
  let created = 0
  for (const notice of notices) {
    const due = new Date(today)
    due.setUTCDate(due.getUTCDate() + notice.days)
    const date = due.toISOString().slice(0, 10)
    const rows = await c.env.RENT.prepare(`
      SELECT o.id, o.orderNo, o.userId, o.endDate, u.name
      FROM orders o JOIN users u ON u.id = o.userId
      WHERE o.endDate = ? AND o.status IN ('paid', 'active') AND u.role = 'CUSTOMER'
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_id = o.userId AND n.order_id = o.id AND n.type = ?)
    `).bind(date, notice.type).all()
    for (const order of (rows.results || []) as any[]) {
      await createNotification(c, { recipientId: order.userId, type: notice.type, title: notice.title, message: `${notice.text} 订单：${order.orderNo || order.id}。`, orderId: order.id })
      created += 1
    }
  }
  return created
}

// 投递 notifyAgreementUpdate 排入 email_events 队列的协议更新邮件。
// 由 cron 触发，每次只处理一小批，避免一次调用里对外发起过多子请求；
// 失败的行会在下一次 tick 自动重试，直到 max_attempts。
export async function deliverPendingAgreementEmails(c: Context): Promise<number> {
  const { apiKey, from } = await resolveResendCredentials(c)
  if (!apiKey || !from) return 0
  const rows = (((await c.env.RENT.prepare(
    "SELECT id, recipient, subject, text_body, html_body FROM email_events WHERE event_type = 'AGREEMENT_UPDATE' AND status IN ('PENDING', 'FAILED') AND retry_count < max_attempts ORDER BY created_at LIMIT 90"
  ).all()) as any).results || []) as any[]
  let sent = 0
  for (const row of rows) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient], subject: row.subject, text: row.text_body, html: row.html_body || undefined }),
      })
      const result = await response.json().catch(() => ({})) as any
      await c.env.RENT.prepare(
        "UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE id = ?"
      ).bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status).slice(0, 500), response.ok ? 1 : 0, row.id).run()
      if (response.ok) sent += 1
    } catch (error: any) {
      await c.env.RENT.prepare(
        "UPDATE email_events SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(String(error?.message || error).slice(0, 500), row.id).run()
    }
  }
  return sent
}

export async function notifyOverduePaymentProofs(c: Context): Promise<number> {
  await c.env.RENT.prepare('ALTER TABLE payment_proofs ADD COLUMN admin_notified_at TEXT').run().catch(() => undefined)
  await ensureNotificationsTable(c)
  const proofs = await c.env.RENT.prepare(`
    SELECT pp.id, pp.payment_id, pp.uploaded_at, o.id AS order_id, o.orderNo, o.totalAmount,
           p.payment_method, u.name AS customer_name
    FROM payment_proofs pp
    JOIN payments p ON p.id = pp.payment_id
    JOIN orders o ON o.id = p.rental_id
    LEFT JOIN users u ON u.id = o.userId
    WHERE pp.status = 'submitted'
      AND pp.admin_notified_at IS NULL
      AND pp.uploaded_at <= datetime('now', '-1 hour')
      AND p.payment_method IN ('bank_transfer', 'alipay', 'wechat')
      AND o.status = 'pending_payment'
    ORDER BY pp.uploaded_at ASC
    LIMIT 100
  `).all() as any
  if (!(proofs.results || []).length) return 0
  const admins = (await c.env.RENT.prepare("SELECT id, email, name FROM users WHERE role = 'ADMIN' AND status = 'active'").all() as any).results || []
  if (!admins.length) return 0
  const { apiKey, from } = await resolveResendCredentials(c)
  let notified = 0
  for (const proof of proofs.results as any[]) {
    const method = proof.payment_method === 'alipay' ? '支付宝' : proof.payment_method === 'wechat' ? '微信' : '银行转账'
    const orderLabel = proof.orderNo || proof.order_id
    const title = `${method}付款待审核超过 1 小时`
    const message = `订单 ${orderLabel} 的${method}付款凭证已提交超过 1 小时，客户：${proof.customer_name || '未填写'}，金额：AUD ${Number(proof.totalAmount || 0).toFixed(2)}。请尽快审核。`
    await Promise.all(admins.map((admin: any) => createNotification(c, { recipientId: admin.id, type: 'payment_review_overdue', title, message, orderId: proof.order_id })))
    if (apiKey && from) {
      const html = renderEmailNotificationHtml(title, `<p>${message}</p><p><a href="${new URL(`/admin/orders/${proof.order_id}`, c.req.url).toString()}">打开订单审核</a></p>`, getSystemSettings().companyDetails.name)
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: admins.map((admin: any) => admin.email).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)), subject: title, text: message, html }) })
    }
    await c.env.RENT.prepare('UPDATE payment_proofs SET admin_notified_at = CURRENT_TIMESTAMP WHERE id = ? AND admin_notified_at IS NULL').bind(proof.id).run()
    notified += 1
  }
  return notified
}
