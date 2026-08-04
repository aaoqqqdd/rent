import { Context } from 'hono'
import { getSystemSettings, updateSystemSettings } from '../../site'
import { getStripeConfigSummary, saveStripeConfig } from '../../stripe'

export async function handleSaveAdminSettings(c: Context): Promise<Response> {
  // index.ts 已经完成 admin 权限校验，这里不再依赖 c.get('user')。
  const bodyText = await c.req.text()
  const payload = JSON.parse(bodyText || '{}')


  const next = {
    rentalTerms: payload.rentalTerms ?? getSystemSettings().rentalTerms,
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

  if (payload.stripeConfig) await saveStripeConfig(c, payload.stripeConfig)
  await updateSystemSettings(c, next as any)

  return c.json({ success: true, settings: getSystemSettings(), stripe: await getStripeConfigSummary(c) })
}
