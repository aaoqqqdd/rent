import { Context } from 'hono'
import { getSystemSettings, updateSystemSettings } from '../../site'

export async function handleSaveAdminSettings(c: Context): Promise<Response> {
  // index.ts 已经完成 admin 权限校验，这里不再依赖 c.get('user')。
  const bodyText = await c.req.text()
  const payload = JSON.parse(bodyText || '{}')


  const next = {
    rentalTerms: payload.rentalTerms ?? getSystemSettings().rentalTerms,
    priceStrategy: payload.priceStrategy ?? getSystemSettings().priceStrategy,
    paymentMethods: {
      square: Boolean(payload.paymentMethods?.square),
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

  // 现阶段仓库的 systemSettings 是内存对象，没有 D1 表；先把接口打通，避免前端“演示保存”。
  // 后续如果你补了 settings 表/kv，我再把这里改成真正落库。
  await updateSystemSettings(c, next as any)

  return c.json({ success: true, settings: getSystemSettings() })
}

