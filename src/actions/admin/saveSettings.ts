import { Context } from 'hono'
import { getSystemSettings, updateSystemSettings, sanitizeRichHtml } from '../../site'
import { getStripeConfigSummary, saveStripeConfig } from '../../stripe'

export async function handleSaveAdminSettings(c: Context): Promise<Response> {
  // index.ts 已经完成 admin 权限校验，这里不再依赖 c.get('user')。
  const bodyText = await c.req.text()
  const payload = JSON.parse(bodyText || '{}')

  const stripeConfigInput = payload.stripeConfig
  const shouldSaveStripeConfig = Boolean(
    stripeConfigInput &&
    (
      stripeConfigInput.publishableKey ||
      stripeConfigInput.secretKey ||
      stripeConfigInput.webhookSecret ||
      stripeConfigInput.clear === true
    )
  )

  const next = {
    companyDetails: {
      abn: String(payload.companyDetails?.abn ?? getSystemSettings().companyDetails.abn).trim(),
      gstIncluded: Boolean(payload.companyDetails?.gstIncluded),
      address: String(payload.companyDetails?.address ?? getSystemSettings().companyDetails.address).trim(),
      contact: String(payload.companyDetails?.contact ?? getSystemSettings().companyDetails.contact).trim(),
      phone: String(payload.companyDetails?.phone ?? getSystemSettings().companyDetails.phone).trim(),
      email: String(payload.companyDetails?.email ?? getSystemSettings().companyDetails.email).trim(),
    },
    rentalTerms: sanitizeRichHtml(payload.rentalTerms ?? getSystemSettings().rentalTerms),
    priceStrategy: payload.priceStrategy ?? getSystemSettings().priceStrategy,
    paymentMethods: {
      stripe: Boolean(payload.paymentMethods?.stripe),
      bankTransfer: Boolean(payload.paymentMethods?.bankTransfer),
      balancePayment: Boolean(payload.paymentMethods?.balancePayment),
    },
    bankDetails: {
      accountName: payload.bankDetails?.accountName ?? getSystemSettings().bankDetails.accountName,
      bsb: payload.bankDetails?.bsb ?? getSystemSettings().bankDetails.bsb,
      account: payload.bankDetails?.account ?? getSystemSettings().bankDetails.account,
    },
    emailTemplate: payload.emailTemplate ?? getSystemSettings().emailTemplate,
    referralSettings: {
      defaultRate: Number(payload.referralSettings?.defaultRate ?? getSystemSettings().referralSettings.defaultRate),
      levelLimit: Number(payload.referralSettings?.levelLimit ?? getSystemSettings().referralSettings.levelLimit),
      settlementPeriod: Number(payload.referralSettings?.settlementPeriod ?? getSystemSettings().referralSettings.settlementPeriod),
    },
  }

  if (shouldSaveStripeConfig) await saveStripeConfig(c, stripeConfigInput)
  await updateSystemSettings(c, next as any)

  return c.json({ success: true, settings: getSystemSettings(), stripe: await getStripeConfigSummary(c) })
}
