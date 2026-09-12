/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import { getSystemSettings, loadSystemSettingsFromDB, updateSystemSettings } from '../../site'
import { getStripeConfigSummary, saveStripeConfig } from '../../stripe'
import { getEmailConfigSummary, saveEmailConfig } from '../../emailConfig'
import { getNotifyChannelsSummary, saveNotifyChannels } from '../../notifyChannels'
import { enqueueAgreementUpdate } from '../../services/notifications'

/** 保存协议更新记录，实际通知由定时任务统一发送。 */
export async function notifyAgreementUpdate(c: Context, changedAgreements: Array<[string, string]>, _companyDetails?: any, _changedContent = ''): Promise<void> {
  if (!changedAgreements.length) return
  try {
    await enqueueAgreementUpdate(c, changedAgreements, _changedContent)
  } catch (error: any) {
    console.error('enqueueAgreementUpdate failed:', error?.message || error)
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

  const notifyChannelsInput = payload.notifyChannels
  const shouldSaveNotifyChannels = Boolean(
    notifyChannelsInput &&
    (
      notifyChannelsInput.clear === true ||
      notifyChannelsInput.resendApiKey || notifyChannelsInput.resendClear === true ||
      notifyChannelsInput.resendFrom !== undefined ||
      'telegramEnabled' in notifyChannelsInput || 'serverChanEnabled' in notifyChannelsInput || 'webhookEnabled' in notifyChannelsInput ||
      notifyChannelsInput.telegramBotToken || notifyChannelsInput.serverChanSendKey || notifyChannelsInput.webhookUrl
    )
  )
  if (shouldSaveNotifyChannels) await saveNotifyChannels(c, notifyChannelsInput)

  await updateSystemSettings(c, next as any)
  await loadSystemSettingsFromDB(c)

  return c.json({ success: true, settings: getSystemSettings(), stripe: await getStripeConfigSummary(c), email: await getEmailConfigSummary(c), notify: await getNotifyChannelsSummary(c) })
}
