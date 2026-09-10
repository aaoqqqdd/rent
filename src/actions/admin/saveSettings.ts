/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import { getSystemSettings, loadSystemSettingsFromDB, updateSystemSettings, ensureNotificationsTable, renderEmailNotificationHtml } from '../../site'
import { getStripeConfigSummary, saveStripeConfig } from '../../stripe'
import { getEmailConfigSummary, saveEmailConfig } from '../../emailConfig'

/**
 * 协议变更后通知客户。设计约束：
 * 1. 站内信是可靠通道——用一条批量 INSERT 写给所有活跃客户，不再逐个往返，
 *    也不会因为其中一条失败而整体丢通知。
 * 2. 邮件改成异步：这里只把待发邮件写进 email_events 队列，真正的外呼由
 *    定时任务 deliverPendingAgreementEmails 分批完成，避免在保存请求里打
 *    成百上千个 fetch（会撞上 Workers 子请求上限而整体抛错）。
 * 3. 整个函数吞掉所有异常——通知失败绝不能把「协议已保存」变成一次报错。
 */
export async function notifyAgreementUpdate(c: Context, changedAgreements: Array<[string, string]>, companyDetails: any): Promise<void> {
  if (!changedAgreements.length) return
  const names = changedAgreements.map(([, label]) => label).join('、')
  const companyName = String(companyDetails?.name || '')
  const companyEmail = String(companyDetails?.email || '')
  try {
    await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
    await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS email_events (
      id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, recipient TEXT NOT NULL,
      order_id TEXT, template_id TEXT, idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL, provider_message_id TEXT, error_message TEXT, sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subject TEXT, text_body TEXT, html_body TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, last_attempt_at TEXT
    )`).run()

    const template = await c.env.RENT.prepare("SELECT subject, body, enabled FROM email_templates WHERE id = 'agreement_update'").first() as any
    const disabled = template?.enabled === 0
    const fallbackMessage = `我们已更新以下协议内容：${names}。请打开通知详情查看最新版本。`
    const subjectTpl = disabled ? '协议内容已更新' : String(template?.subject || '协议内容已更新')
    const bodyTpl = disabled ? fallbackMessage : String(template?.body || fallbackMessage)

    // 先把「每个收件人都一样」的占位符替换掉，剩下的 {customer_name} /
    // {customer_email} 交给下面按人填充（站内信在 SQL 里填，邮件在 JS 里填）。
    const fillStatic = (value: string) => value
      .replace(/\{changed_agreements\}/g, names)
      .replace(/\{company_name\}/g, companyName)
      .replace(/\{company_email\}/g, companyEmail)
    const subjectStatic = fillStatic(subjectTpl)
    const bodyStatic = fillStatic(bodyTpl)
    const fillCustomer = (value: string, customer: any) => value
      .replace(/\{customer_name\}/g, String(customer?.name || ''))
      .replace(/\{customer_email\}/g, String(customer?.email || ''))

    // 站内信：一条语句写给所有活跃客户（含未填有效邮箱的正式客户和访客）。
    await ensureNotificationsTable(c)
    await c.env.RENT.prepare(`
      INSERT INTO notifications (id, recipient_id, type, title, message)
      SELECT 'nt-' || lower(hex(randomblob(16))), id, 'agreement_update',
             REPLACE(REPLACE(?, '{customer_name}', COALESCE(name, '')), '{customer_email}', COALESCE(email, '')),
             REPLACE(REPLACE(?, '{customer_name}', COALESCE(name, '')), '{customer_email}', COALESCE(email, ''))
      FROM users WHERE role = 'CUSTOMER' AND status = 'active'
    `).bind(subjectStatic, bodyStatic).run()

    // 邮件：写入 email_events 队列（PENDING），外呼交给定时任务分批处理。
    const recipients = ((await c.env.RENT.prepare("SELECT name, email FROM users WHERE role = 'CUSTOMER' AND status = 'active'").all()) as any).results || []
    const today = new Date().toISOString().slice(0, 10)
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
        return c.env.RENT.prepare("INSERT OR IGNORE INTO email_events (id, event_type, recipient, idempotency_key, status, subject, text_body, html_body) VALUES (?, 'AGREEMENT_UPDATE', ?, ?, 'PENDING', ?, ?, ?)")
          .bind(`email-${crypto.randomUUID()}`, customer.email, `agreement_update:${today}:${names}:${customer.email}`, subject, message.replace(/<[^>]+>/g, ''), html)
      }))
    }
  } catch (error: any) {
    console.error('notifyAgreementUpdate failed:', error?.message || error)
  }
}

export async function handleSaveAdminSettings(c: Context): Promise<Response> {
  // index.ts 已经完成 admin 权限校验，这里不再依赖 c.get('user')。
  const bodyText = await c.req.text()
  const payload = JSON.parse(bodyText || '{}')

  // Always hydrate the current values before merging the settings form.
  // Otherwise a fresh worker can overwrite database-backed agreements with
  // the in-code defaults when only company settings are being saved.
  await loadSystemSettingsFromDB(c)

  const stripeConfigInput = payload.stripeConfig
  const shouldSaveStripeConfig = Boolean(
    stripeConfigInput &&
    (
      stripeConfigInput.secretKey ||
      stripeConfigInput.webhookSecret ||
      stripeConfigInput.clear === true
    )
  )

  const next = {
    companyDetails: {
      name: String(payload.companyDetails?.name ?? getSystemSettings().companyDetails.name).trim(),
      abn: String(payload.companyDetails?.abn ?? getSystemSettings().companyDetails.abn).trim(),
      gstIncluded: Boolean(payload.companyDetails?.gstIncluded),
      address: String(payload.companyDetails?.address ?? getSystemSettings().companyDetails.address).trim(),
      contact: String(payload.companyDetails?.contact ?? getSystemSettings().companyDetails.contact).trim(),
      phone: String(payload.companyDetails?.phone ?? getSystemSettings().companyDetails.phone).trim(),
      email: String(payload.companyDetails?.email ?? getSystemSettings().companyDetails.email).trim(),
      website: String(payload.companyDetails?.website ?? getSystemSettings().companyDetails.website).trim(),
      logo: String(payload.companyDetails?.logo ?? getSystemSettings().companyDetails.logo).trim(),
      pickupLocations: Array.isArray(payload.companyDetails?.pickupLocations)
        ? payload.companyDetails.pickupLocations.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 20)
        : getSystemSettings().companyDetails.pickupLocations,
      deliveryAreas: Array.isArray(payload.companyDetails?.deliveryAreas)
        ? payload.companyDetails.deliveryAreas.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 50)
        : getSystemSettings().companyDetails.deliveryAreas,
      deliveryNote: String(payload.companyDetails?.deliveryNote ?? getSystemSettings().companyDetails.deliveryNote).trim(),
    },
    priceStrategy: payload.priceStrategy ?? getSystemSettings().priceStrategy,
    paymentMethods: {
      stripe: Boolean(payload.paymentMethods?.stripe),
      bankTransfer: Boolean(payload.paymentMethods?.bankTransfer),
      balancePayment: Boolean(payload.paymentMethods?.balancePayment),
      alipay: Boolean(payload.paymentMethods?.alipay),
      wechat: Boolean(payload.paymentMethods?.wechat),
      processingFeeRate: Math.min(1, Math.max(0, Number(payload.paymentMethods?.processingFeeRate ?? getSystemSettings().paymentMethods.processingFeeRate ?? 0.025))),
    },
    bankDetails: {
      bankName: String(payload.bankDetails?.bankName ?? getSystemSettings().bankDetails.bankName).trim().slice(0, 120),
      accountName: String(payload.bankDetails?.accountName ?? getSystemSettings().bankDetails.accountName).trim().slice(0, 120),
      bsb: String(payload.bankDetails?.bsb ?? getSystemSettings().bankDetails.bsb).trim().replace(/\s+/g, '').slice(0, 20),
      account: String(payload.bankDetails?.account ?? getSystemSettings().bankDetails.account).trim().replace(/\s+/g, '').slice(0, 40),
    },
    rmbPayment: {
      alipayQrUrl: String(payload.rmbPayment?.alipayQrUrl ?? getSystemSettings().rmbPayment.alipayQrUrl).trim().slice(0, 500),
      wechatQrUrl: String(payload.rmbPayment?.wechatQrUrl ?? getSystemSettings().rmbPayment.wechatQrUrl).trim().slice(0, 500),
    },
    referralSettings: {
      defaultRate: Number(payload.referralSettings?.defaultRate ?? getSystemSettings().referralSettings.defaultRate),
      levelLimit: Number(payload.referralSettings?.levelLimit ?? getSystemSettings().referralSettings.levelLimit),
      settlementPeriod: Number(payload.referralSettings?.settlementPeriod ?? getSystemSettings().referralSettings.settlementPeriod),
    },
    rentalRules: {
      unavailableDates: Array.isArray(payload.rentalRules?.unavailableDates)
        ? payload.rentalRules.unavailableDates.map((value: unknown) => String(value).trim()).filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)).slice(0, 366)
        : getSystemSettings().rentalRules.unavailableDates,
      unavailableTimeSlots: payload.rentalRules?.unavailableTimeSlots && typeof payload.rentalRules.unavailableTimeSlots === 'object' && !Array.isArray(payload.rentalRules.unavailableTimeSlots)
        ? Object.fromEntries(Object.entries(payload.rentalRules.unavailableTimeSlots).filter(([date, slots]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(slots)).slice(0, 366).map(([date, slots]) => [date, (slots as unknown[]).filter(value => ['morning_service', 'morning', 'afternoon', 'evening_service'].includes(String(value))).slice(0, 4)]).filter(([, slots]) => (slots as unknown[]).length > 0))
        : getSystemSettings().rentalRules.unavailableTimeSlots,
      minimumRentalDays: Math.max(1, Math.floor(Number(payload.rentalRules?.minimumRentalDays ?? getSystemSettings().rentalRules.minimumRentalDays) || 1)),
      bufferDays: Math.max(0, Math.floor(Number(payload.rentalRules?.bufferDays ?? getSystemSettings().rentalRules.bufferDays) || 0)),
    },
    registrationSettings: {
      requireEmailVerification: Boolean(payload.registrationSettings?.requireEmailVerification),
    },
  }

  for (const [name, value] of Object.entries(next.rmbPayment)) {
    if (value && (!/^https:\/\//i.test(String(value)) || String(value).includes('"'))) throw new Error(`${name} 必须是 HTTPS 图片地址`)
  }

  if (shouldSaveStripeConfig) await saveStripeConfig(c, stripeConfigInput)
  const emailTransportInput = payload.emailTransport
  const shouldSaveEmailTransport = Boolean(
    emailTransportInput &&
    (
      emailTransportInput.clear === true ||
      emailTransportInput.host ||
      emailTransportInput.user ||
      emailTransportInput.password ||
      emailTransportInput.from
    )
  )
  if (shouldSaveEmailTransport) await saveEmailConfig(c, emailTransportInput)
  await updateSystemSettings(c, next as any)
  await loadSystemSettingsFromDB(c)

  return c.json({ success: true, settings: getSystemSettings(), stripe: await getStripeConfigSummary(c), email: await getEmailConfigSummary(c) })
}
