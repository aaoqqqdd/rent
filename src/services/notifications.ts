/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 站内通知 + 若干由 cron 触发的通知 / 邮件投递任务。
// 依赖 settings（公司信息、发件人）与 lib/html（邮件模板）。

import type { Context } from 'hono'
import { renderEmailNotificationHtml, sanitizePlainText } from '../lib/html'
import { safeJsonParse } from '../lib/json'
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
    expires_at TEXT,
    dedupe_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN sender_id TEXT REFERENCES users(id) ON DELETE SET NULL').run() } catch (_) { /* column already exists */ }
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN deleted_at TEXT').run() } catch (_) { /* column already exists */ }
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN expires_at TEXT').run() } catch (_) { /* column already exists */ }
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN dedupe_key TEXT').run() } catch (_) { /* column already exists */ }
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, read_at, created_at DESC)').run()
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_sender_created ON notifications(sender_id, deleted_at, created_at DESC)').run()
    await c.env.RENT.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL').run()
  })()
  try { await notificationsSchemaReady } catch (error) { notificationsSchemaReady = null; throw error }
}

async function ensureAgreementUpdateQueueTable(c: Context): Promise<void> {
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS agreement_update_queue (
    agreement_key TEXT PRIMARY KEY NOT NULL,
    agreement_label TEXT NOT NULL,
    revision TEXT NOT NULL,
    queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
}

async function ensureAgreementEmailEventsTable(c: Context): Promise<void> {
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS email_events (
    id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, recipient TEXT NOT NULL,
    order_id TEXT, template_id TEXT, idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL, provider_message_id TEXT, error_message TEXT, sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subject TEXT, text_body TEXT, html_body TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, last_attempt_at TEXT
  )`).run()
}

function normalizeCustomerName(value: unknown): string {
  const name = String(value || '').trim().replace(/\s+/g, ' ')
  return name.replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
}

function normalizeAgreementUpdateTemplate(value: string): string {
  return value
    .replace(/请登录后查看最新版本/g, '请查看通知详情中的最新版本')
    .replace(/请打开通知详情查看最新版本/g, '请查看通知详情中的最新版本')
}

// 保存协议时只排队，不创建客户通知，也不调用外部邮件服务。
// 同一协议在下一次定时任务前重复保存只保留一项；不同协议会在发送时合并成一条通知。
export async function enqueueAgreementUpdate(c: Context, changedAgreements: Array<[string, string]>, changedContent = ''): Promise<void> {
  const changes = new Map<string, string>()
  for (const [key, label] of changedAgreements) {
    if (key && label) changes.set(key, label)
  }
  if (!changes.size) return
  await ensureAgreementUpdateQueueTable(c)
  const revisions = await Promise.all([...changes].map(async ([key, label]) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}\n${label}\n${changedContent}`))
    return [key, label, Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')] as const
  }))
  await c.env.RENT.batch(revisions.map(([key, label, revision]) => c.env.RENT.prepare(`
    INSERT INTO agreement_update_queue (agreement_key, agreement_label, revision)
    VALUES (?, ?, ?)
    ON CONFLICT(agreement_key) DO UPDATE SET
      agreement_label = excluded.agreement_label,
      revision = excluded.revision,
      queued_at = CURRENT_TIMESTAMP
  `).bind(key, label, revision)))
}

// 定时任务统一创建协议更新通知和邮件事件。返回本次处理的客户数。
export async function deliverPendingAgreementNotifications(c: Context): Promise<number> {
  await ensureAgreementUpdateQueueTable(c)
  const rows = (((await c.env.RENT.prepare('SELECT agreement_key, agreement_label, revision, queued_at FROM agreement_update_queue ORDER BY queued_at, agreement_key').all()) as any).results || []) as any[]
  if (!rows.length) return 0

  const names = rows.map((row) => String(row.agreement_label)).join('、')
  const batchKey = rows.map((row) => `${row.agreement_key}:${row.revision}`).join('|')
  const dedupeKey = `agreement_update:${batchKey}`
  const companyRow = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'companyDetails'").first() as any
  const storedCompanyDetails = safeJsonParse<any>(companyRow?.value) || {}
  const companyDetails = { ...getSystemSettings().companyDetails, ...storedCompanyDetails }
  const companyName = String(companyDetails?.name || '')
  const companyEmail = String(companyDetails?.email || '')

  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  await ensureAgreementEmailEventsTable(c)
  const template = await c.env.RENT.prepare("SELECT subject, body, enabled FROM email_templates WHERE id = 'agreement_update'").first() as any
  const disabled = template?.enabled === 0
  const fallbackMessage = '我们已更新《{changed_agreements}》，最新版本已在我们的网站相关页面公布。继续使用我们的服务，即表示您接受更新后的条款。'
  const subjectTpl = disabled ? '{changed_agreements}更新通知' : String(template?.subject || '{changed_agreements}更新通知')
  const bodyTpl = disabled ? fallbackMessage : normalizeAgreementUpdateTemplate(String(template?.body || fallbackMessage))
  const fillStatic = (value: string) => value
    .replace(/\{changed_agreements\}/g, names)
    .replace(/\{company_name\}/g, companyName)
    .replace(/\{company_email\}/g, companyEmail)
  const subjectStatic = fillStatic(subjectTpl)
  const bodyStatic = fillStatic(bodyTpl)
  const fillCustomer = (value: string, customer: any) => value
    .replace(/\{customer_name\}/g, normalizeCustomerName(customer?.name))
    .replace(/\{customer_email\}/g, String(customer?.email || ''))

  // Site notification detail carries the full notice text (the list/drawer show a
  // short computed summary instead, see notificationListMessage in src/index.ts).
  // Kept independent of the configurable email template so an old saved template
  // can't leave a signed-in customer with confusing wording in the site notification.
  const siteMessageStatic = `<p>尊敬的 {customer_name}：</p><p>您好！</p><p>我们已更新《${names}》，最新版本已在我们的网站相关页面公布。</p><p>继续使用我们的服务，即表示您接受更新后的条款。如您不同意相关更新，请停止使用相关服务，并联系我们处理后续事宜。</p><p>感谢您的理解与支持！</p><p><strong>${companyName}</strong><br>${companyEmail}</p>`

  await ensureNotificationsTable(c)
  const recipients = ((await c.env.RENT.prepare("SELECT id, name, email FROM users WHERE role = 'CUSTOMER' AND status = 'active'").all()) as any).results || []
  for (let i = 0; i < recipients.length; i += 50) {
    const chunk = recipients.slice(i, i + 50)
    await c.env.RENT.batch(chunk.map((customer: any) => c.env.RENT.prepare(
      'INSERT OR IGNORE INTO notifications (id, recipient_id, type, title, message, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      `nt-${crypto.randomUUID()}`,
      customer.id,
      'agreement_update',
      fillCustomer(subjectStatic, customer),
      fillCustomer(siteMessageStatic, customer),
      dedupeKey,
    )))
  }

  const queued = recipients.filter((customer: any) => {
    const email = String(customer?.email || '')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('@invalid.local')
  })
  for (let i = 0; i < queued.length; i += 50) {
    const chunk = queued.slice(i, i + 50)
    await c.env.RENT.batch(chunk.map((customer: any) => {
      const subject = fillCustomer(subjectStatic, customer)
      const message = fillCustomer(bodyStatic, customer)
      const html = renderEmailNotificationHtml(subject, message, companyName)
      return c.env.RENT.prepare("INSERT OR IGNORE INTO email_events (id, event_type, recipient, template_id, idempotency_key, status, subject, text_body, html_body) VALUES (?, 'AGREEMENT_UPDATE', ?, 'agreement_update_batch', ?, 'PENDING', ?, ?, ?)")
        .bind(`email-${crypto.randomUUID()}`, customer.email, `${dedupeKey}:${customer.email}`, subject, sanitizePlainText(message, 20000), html)
    }))
  }

  // 先完成站内信与邮件事件，再删除本批队列；保存期间新 revision 的行会被保留到下一批。
  await c.env.RENT.batch(rows.map((row) => c.env.RENT.prepare('DELETE FROM agreement_update_queue WHERE agreement_key = ? AND revision = ?').bind(row.agreement_key, row.revision)))
  return queued.length
}

export async function createNotification(c: Context, notification: { recipientId: string; type: string; title: string; message: string; orderId?: string; senderId?: string; expiresAt?: string | null; dedupeKey?: string | null }): Promise<void> {
  await ensureNotificationsTable(c)
  const id = `nt-${crypto.randomUUID()}`
  await c.env.RENT.prepare('INSERT OR IGNORE INTO notifications (id, recipient_id, type, title, message, order_id, sender_id, expires_at, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, notification.recipientId, notification.type, notification.title, notification.message, notification.orderId || null, notification.senderId || null, notification.expiresAt || null, notification.dedupeKey || null).run()

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

export async function deleteRentalApplicationNotifications(c: Context, orderId: string): Promise<void> {
  await ensureNotificationsTable(c)
  await c.env.RENT.prepare("UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ? AND type = 'rental_application' AND deleted_at IS NULL").bind(orderId).run()
}

export async function cleanupCompletedRentalApplicationNotifications(c: Context, recipientId?: string): Promise<void> {
  await ensureNotificationsTable(c)
  const recipientFilter = recipientId ? ' AND recipient_id = ?' : ''
  const bindings = recipientId ? [recipientId] : []
  await c.env.RENT.prepare(`UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE type = 'rental_application' AND deleted_at IS NULL${recipientFilter} AND EXISTS (SELECT 1 FROM orders WHERE orders.id = notifications.order_id AND orders.status <> 'pending_approval')`).bind(...bindings).run()
}

export async function getNotifications(c: Context, recipientId: string): Promise<any[]> {
  await ensureNotificationsTable(c)
  await cleanupCompletedRentalApplicationNotifications(c, recipientId)
  const result = await c.env.RENT.prepare("SELECT * FROM notifications WHERE recipient_id = ? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) AND NOT (type = 'agreement_update' AND EXISTS (SELECT 1 FROM notifications newer WHERE newer.recipient_id = notifications.recipient_id AND newer.type = notifications.type AND newer.title = notifications.title AND newer.message = notifications.message AND (newer.created_at > notifications.created_at OR (newer.created_at = notifications.created_at AND newer.rowid > notifications.rowid)))) ORDER BY created_at DESC LIMIT 100").bind(recipientId).all()
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
      const id = `nt-${crypto.randomUUID()}`
      const result = await c.env.RENT.prepare(`
        INSERT OR IGNORE INTO notifications (id, recipient_id, type, title, message, order_id, sender_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, order.userId, notice.type, notice.title, `${notice.text} 订单：${order.orderNo || order.id}。`, order.id, null, null).run() as any
      created += Number(result.meta?.changes ?? result.changes ?? 0)
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
    "SELECT id, recipient, subject, text_body, html_body FROM email_events WHERE event_type = 'AGREEMENT_UPDATE' AND template_id = 'agreement_update_batch' AND ((status IN ('PENDING', 'FAILED') AND retry_count < max_attempts) OR (status = 'SENDING' AND retry_count < max_attempts AND last_attempt_at <= datetime('now', '-15 minutes'))) ORDER BY created_at LIMIT 90"
  ).all()) as any).results || []) as any[]
  let sent = 0
  for (const row of rows) {
    // Claim before the external request. Cron retries/overlapping invocations
    // must never send the same event twice just because its old read status or
    // a previous invocation has not been written back yet.
    const claimed = await c.env.RENT.prepare(
      "UPDATE email_events SET status = 'SENDING', retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP WHERE id = ? AND ((status IN ('PENDING', 'FAILED') AND retry_count < max_attempts) OR (status = 'SENDING' AND retry_count < max_attempts AND last_attempt_at <= datetime('now', '-15 minutes')))"
    ).bind(row.id).run() as any
    const claimChanges = Number(claimed.meta?.changes ?? claimed.changes ?? 0)
    if (claimChanges !== 1) continue
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient], subject: row.subject, text: row.text_body, html: row.html_body || undefined }),
      })
      const result = await response.json().catch(() => ({})) as any
      await c.env.RENT.prepare(
        "UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE id = ? AND status = 'SENDING'"
      ).bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status).slice(0, 500), response.ok ? 1 : 0, row.id).run()
      if (response.ok) sent += 1
    } catch (error: any) {
      await c.env.RENT.prepare(
        "UPDATE email_events SET status = 'FAILED', error_message = ? WHERE id = ? AND status = 'SENDING'"
      ).bind(String(error?.message || error).slice(0, 500), row.id).run()
    }
  }
  return sent
}

// 协议更新只使用一个调度入口：先把窗口内的变更生成站内信和邮件事件，
// 再在同一个任务中投递邮件，避免两个独立定时任务重复处理同一批数据。
export async function deliverPendingAgreementUpdates(c: Context): Promise<{ queuedRecipients: number; sentEmails: number }> {
  const queuedRecipients = await deliverPendingAgreementNotifications(c)
  const sentEmails = await deliverPendingAgreementEmails(c)
  return { queuedRecipients, sentEmails }
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
