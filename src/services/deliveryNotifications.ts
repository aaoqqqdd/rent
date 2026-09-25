import type { Context } from 'hono'
import { getDeliveryRuntimeConfig } from '../deliveryConfig'
import { deliveryStatusInfo } from '../deliveryStatus'
import { escapeHtml, renderEmailNotificationHtml, sanitizePlainText } from '../lib/html'
import { sendTransactionalEmail } from '../notifyChannels'
import { getSystemSettings } from '../site'

type DeliveryBindings = { RENT: D1Database }

async function sameSecret(left: string, right: string): Promise<boolean> {
  if (!left || !right) return false
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ])
  const a = new Uint8Array(leftHash)
  const b = new Uint8Array(rightHash)
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] || 0) ^ (b[index] || 0)
  return difference === 0
}

function safeTrackingUrl(value: unknown): string {
  const raw = String(value || '').trim()
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 1000) : ''
  } catch {
    return ''
  }
}

export async function handleDeliveryStatusEmail(c: Context<{ Bindings: DeliveryBindings }>): Promise<Response> {
  const config = await getDeliveryRuntimeConfig(c as any)
  const authorization = String(c.req.header('Authorization') || '')
  if (!(await sameSecret(authorization, `Bearer ${config.adminToken}`))) return c.json({ ok: false }, 401)

  let body: Record<string, unknown> = {}
  try { body = await c.req.json() as Record<string, unknown> } catch { return c.json({ ok: false, message: '请求格式无效。' }, 400) }
  const bookingId = String(body.bookingId || '').trim().slice(0, 120)
  if (!bookingId) return c.json({ ok: false, message: '缺少配送订单编号。' }, 400)

  const db = c.env.RENT
  const booking = await db.prepare(`
    SELECT b.id, b.status, b.direction, b.tracking_url, b.provider_reference,
      o.id AS order_id, o.orderNo AS order_no, u.email, u.name AS customer_name,
      d.name AS device_name
    FROM delivery_bookings b
    JOIN orders o ON o.id = b.order_id
    JOIN users u ON u.id = o.userId
    LEFT JOIN devices d ON d.id = o.deviceId
    WHERE b.id = ? LIMIT 1
  `).bind(bookingId).first<Record<string, unknown>>()
  if (!booking) return c.json({ ok: true, skipped: true }, 200)

  const email = String(booking.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return c.json({ ok: true, skipped: true }, 200)
  const status = deliveryStatusInfo(booking.status)
  const direction = String(booking.direction) === 'return' ? '回收' : '派送'
  const orderNo = String(booking.order_no || booking.order_id)
  const key = `delivery-status:${booking.id}:${status.key}`
  const existing = await db.prepare('SELECT id, status FROM email_events WHERE idempotency_key = ? LIMIT 1').bind(key).first<Record<string, unknown>>()
  if (String(existing?.status || '') === 'SENT') return c.json({ ok: true, duplicate: true }, 200)
  if (existing && !['FAILED', 'SKIPPED'].includes(String(existing.status || ''))) return c.json({ ok: true, duplicate: true }, 200)
  const eventId = String(existing?.id || `email-delivery-${crypto.randomUUID().replaceAll('-', '')}`)
  if (!existing) {
    await db.prepare(`INSERT OR IGNORE INTO email_events
      (id, event_type, recipient, order_id, idempotency_key, status)
      VALUES (?, 'DELIVERY_STATUS', ?, ?, ?, 'PENDING')`).bind(eventId, email, booking.order_id, key).run()
  }

  const trackingUrl = safeTrackingUrl(booking.tracking_url)
  const subject = `配送状态更新：订单 ${orderNo} · ${status.label}`
  const text = `您好，您的订单 ${orderNo} 的${direction}状态已更新为：${status.label}。\n${status.description}${trackingUrl ? `\n追踪链接：${trackingUrl}` : ''}`
  const trackingHtml = trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}">查看 Zoom2u 追踪信息</a></p>` : ''
  const content = `<p>您好，您的订单 <strong>${escapeHtml(orderNo)}</strong> 的${direction}状态已更新为：</p><p><strong>${escapeHtml(status.label)}</strong></p><p>${escapeHtml(status.description)}</p>${trackingHtml}<p>设备：${escapeHtml(booking.device_name || '租赁设备')}<br>配送编号：${escapeHtml(booking.provider_reference || '')}</p>`
  const company = getSystemSettings().companyDetails.name
  const result = await sendTransactionalEmail(c as any, {
    to: email,
    subject: sanitizePlainText(subject, 200),
    text: sanitizePlainText(text, 2000),
    html: renderEmailNotificationHtml(subject, content, company),
  })
  await db.prepare(`UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?,
    subject = ?, text_body = ?, html_body = ?, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END
    WHERE id = ?`).bind(
    result.ok ? 'SENT' : 'FAILED', result.id || null, result.error || null,
    subject, text, renderEmailNotificationHtml(subject, content, company), result.ok ? 1 : 0, eventId,
  ).run()
  return c.json({ ok: result.ok, message: result.ok ? '已发送配送状态提醒。' : '配送状态邮件发送失败。' }, result.ok ? 200 : 502)
}
