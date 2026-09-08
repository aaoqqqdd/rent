/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// Agent Program（预留，完善.md）——佣金计算纯函数，尚未接入任何结算流程。
export function agentCommission(orderSubtotal: number, rate: number, maxPerOrder?: number | null): number {
  const base = Math.max(0, Number(orderSubtotal) || 0)
  const r = Math.min(1, Math.max(0, Number(rate) || 0))
  let commission = Math.round(base * r * 100) / 100
  if (maxPerOrder != null && Number.isFinite(Number(maxPerOrder))) commission = Math.min(commission, Math.max(0, Number(maxPerOrder)))
  return commission
}
