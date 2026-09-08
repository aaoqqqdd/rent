/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 风险标记与黑名单 (完善.md §22, §32 / TODO.md P2 #10)
//
// 不是一个 is_blacklisted 布尔，而是带类型 / 严重程度 / 证据 / 过期时间的标记表。
// “高风险客户禁止自动创建新租赁”：任意 HIGH 级标记，或命中硬拦截类型
// （拒付、疑似欺诈、设备未归还、付款风险）时阻止客户继续自助下单；
// 过期标记（expires_at 已过）视为失效，不再拦截，也不再显示为有效提示。

export const RISK_FLAG_TYPES = ['PAYMENT_RISK', 'IDENTITY_RISK', 'DEVICE_NOT_RETURNED', 'SERIOUS_DAMAGE', 'CHARGEBACK', 'ABUSE', 'FRAUD_SUSPECTED', 'MANUAL_REVIEW'] as const
export type RiskFlagType = typeof RISK_FLAG_TYPES[number]
export const RISK_FLAG_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

export const ORDER_BLOCKING_RISK_FLAG_TYPES = new Set<RiskFlagType>(['PAYMENT_RISK', 'DEVICE_NOT_RETURNED', 'CHARGEBACK', 'FRAUD_SUSPECTED'])

export interface RiskFlagLike { flag_type?: string; severity?: string; status?: string; expires_at?: string | null }

export function isRiskFlagCurrentlyActive(flag: RiskFlagLike | null | undefined, now: Date = new Date()): boolean {
  if (!flag || String(flag.status || '').toUpperCase() !== 'ACTIVE') return false
  if (!flag.expires_at) return true
  const expiry = new Date(String(flag.expires_at).replace(' ', 'T'))
  return Number.isNaN(expiry.getTime()) ? true : expiry.getTime() > now.getTime()
}

// 返回第一条会阻止客户自助下单的有效标记；没有则返回 null。
export function findBlockingRiskFlag<T extends RiskFlagLike>(flags: Array<T | null | undefined>, now: Date = new Date()): T | null {
  for (const flag of flags || []) {
    if (!isRiskFlagCurrentlyActive(flag, now)) continue
    const severity = String(flag!.severity || '').toUpperCase()
    const type = String(flag!.flag_type || '').toUpperCase() as RiskFlagType
    if (severity === 'HIGH' || ORDER_BLOCKING_RISK_FLAG_TYPES.has(type)) return flag as T
  }
  return null
}
