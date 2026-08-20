/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import { getSystemSettings, loadSystemSettingsFromDB, updateSystemSettings, createNotification, renderEmailNotificationHtml } from '../../site'
import { getStripeConfigSummary, saveStripeConfig } from '../../stripe'
import { getEmailConfigSummary, saveEmailConfig } from '../../emailConfig'

export async function notifyAgreementUpdate(c: Context, changedAgreements: Array<[string, string]>, companyDetails: any): Promise<void> {
  if (!changedAgreements.length) return
  const names = changedAgreements.map(([, label]) => label).join('、')
  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  const template = await c.env.RENT.prepare("SELECT subject, body, enabled FROM email_templates WHERE id = 'agreement_update'").first() as any
  const fill = (value: unknown, customer: any) => String(value || '').replace(/\{customer_name\}/g, String(customer.name || '')).replace(/\{customer_email\}/g, String(customer.email || '')).replace(/\{changed_agreements\}/g, names).replace(/\{company_name\}/g, String(companyDetails.name || '')).replace(/\{company_email\}/g, String(companyDetails.email || ''))
  const title = template?.enabled === 0 ? '协议内容已更新' : String(template?.subject || '协议内容已更新')
  const defaultMessage = `我们已更新以下协议内容：${names}。请打开通知详情查看最新版本。`
  // 站内信不能依赖邮件是否配置成功；访客和暂未填写有效邮箱的正式客户
  // 仍应在通知中心看到协议变更。邮件只是额外的发送通道。
  const customers = await c.env.RENT.prepare("SELECT id, name, email FROM users WHERE role = 'CUSTOMER' AND status = 'active'").all() as any
  const recipients = customers.results || []
  await Promise.allSettled(recipients.map(async (customer: any) => {
    const subject = fill(title, customer)
    const message = template?.enabled === 0 ? defaultMessage : fill(template?.body || defaultMessage, customer)
    await createNotification(c, { recipientId: customer.id, type: 'agreement_update', title: subject, message })
    const apiKey = String((c.env as any).RESEND_API_KEY || '').trim()
    const from = String((c.env as any).EMAIL_FROM || companyDetails.email || '').trim()
    if (!apiKey || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email || '')) || String(customer.email).endsWith('@invalid.local')) return
    const html = renderEmailNotificationHtml(subject, message, companyDetails.name)
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [customer.email], subject, text: message.replace(/<[^>]+>/g, ''), html }) })
    if (!response.ok) throw new Error(`协议更新邮件发送失败: ${response.status}`)
  }))
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
