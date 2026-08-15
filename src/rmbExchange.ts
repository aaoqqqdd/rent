let cached: { rate: number; expiresAt: number } | null = null

export async function getAudCnyRate(): Promise<number> {
  if (cached && cached.expiresAt > Date.now()) return cached.rate
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=AUD&to=CNY', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`汇率服务 ${response.status}`)
    const data = await response.json() as any
    const rate = Number(data?.rates?.CNY)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('汇率无效')
    cached = { rate, expiresAt: Date.now() + 15 * 60 * 1000 }
    return rate
  } catch (error) {
    if (cached) return cached.rate
    throw new Error('暂时无法获取实时人民币汇率，请稍后重试。', { cause: error as Error })
  }
}

export function roundCnyUp(audAmount: number, rate: number): number {
  return Math.ceil(Math.max(0, audAmount) * rate * 100) / 100
}
