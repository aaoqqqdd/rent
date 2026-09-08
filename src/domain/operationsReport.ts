/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 运营分析报表 (完善.md §23, §40)
//
// 金额只从 Ledger / Payment / Refund 明细汇总，不从订单 UI 状态推算。
// 这里放两个纯函数：车队利用率、支付方式占比——其余聚合在路由里用 SQL 完成。

// 车队利用率 = 统计窗口内被租出的“设备·天” / （可租设备数 × 窗口天数），夹在 0..1。
export function deviceUtilisationRate(rentedDeviceDays: number, fleetSize: number, windowDays: number): number {
  const capacity = Math.max(0, Number(fleetSize) || 0) * Math.max(0, Number(windowDays) || 0)
  if (capacity <= 0) return 0
  const used = Math.max(0, Number(rentedDeviceDays) || 0)
  return Math.min(1, Math.max(0, used / capacity))
}

export interface PaymentMethodRow { method: string; amount: number; count?: number }
export interface PaymentMethodShare { method: string; amount: number; count: number; share: number }

// 各支付方式金额占比（百分比，保留两位，误差补到最大的一档，合计恰为 100）。
export function paymentMethodBreakdown(rows: Array<PaymentMethodRow | null | undefined>): PaymentMethodShare[] {
  const clean = (rows || []).filter((r): r is PaymentMethodRow => Boolean(r) && Number(r!.amount) > 0)
    .map(r => ({ method: String(r.method || 'unknown'), amount: Number(r.amount) || 0, count: Number(r.count) || 0 }))
  const total = clean.reduce((sum, r) => sum + r.amount, 0)
  if (total <= 0) return clean.map(r => ({ ...r, share: 0 }))
  const withShare = clean
    .map(r => ({ ...r, share: Math.round((r.amount / total) * 10000) / 100 }))
    .sort((a, b) => b.amount - a.amount)
  const drift = Number((100 - withShare.reduce((sum, r) => sum + r.share, 0)).toFixed(2))
  if (withShare.length && drift !== 0) withShare[0].share = Number((withShare[0].share + drift).toFixed(2))
  return withShare
}
