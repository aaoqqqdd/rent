/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 混合付款 / 退款分配引擎 (TODO.md P1 #6 / 完善.md)
//
// 一笔订单可能由多个来源结算（Stripe + 余额 + 押金 + 调整）。退款时必须把退款
// 额分摊到各来源，且任一来源的累计退款不得超过该来源实付、订单累计退款不得超过
// 订单实付。分摊策略：
//   proportional —— 按各来源“剩余可退”比例分摊（默认）
//   priority     —— 按传入顺序优先退（“优先原支付方式”）
// 分币误差统一由排在前面的来源逐分吸收。

import { formatCurrency } from '../lib/format'

const toCents = (value: number) => Math.round(Number(value) * 100)
const money = (cents: number) => formatCurrency(cents / 100)

export interface RefundSource { id: string; amount: number; refunded?: number; method?: string }
export interface RefundAllocationLine { id: string; amount: number; method?: string }

export function buildRefundAllocation(
  sources: RefundSource[],
  refundAmount: number,
  strategy: 'proportional' | 'priority' = 'proportional',
): RefundAllocationLine[] {
  const requested = toCents(refundAmount)
  const rows = sources.map(s => ({ id: s.id, method: s.method, remaining: Math.max(0, toCents(s.amount) - toCents(s.refunded || 0)) }))
  const capacity = rows.reduce((sum, r) => sum + r.remaining, 0)
  if (!Number.isInteger(requested) || requested <= 0) throw new Error('退款金额必须大于 0')
  if (requested > capacity) throw new Error('退款金额超过原始付款可退余额')

  const assigned = new Map<string, number>()
  if (strategy === 'priority') {
    let left = requested
    for (const r of rows) {
      if (left <= 0) break
      const take = Math.min(left, r.remaining)
      if (take > 0) { assigned.set(r.id, take); left -= take }
    }
  } else {
    let running = 0
    for (const r of rows) {
      const share = capacity ? Math.floor(requested * r.remaining / capacity) : 0
      assigned.set(r.id, share)
      running += share
    }
    // Distribute the rounding remainder one cent at a time, earliest source first.
    let leftover = requested - running
    for (const r of rows) {
      if (leftover <= 0) break
      const cur = assigned.get(r.id) || 0
      if (cur < r.remaining) { assigned.set(r.id, cur + 1); leftover-- }
    }
  }
  return rows
    .filter(r => (assigned.get(r.id) || 0) > 0)
    .map(r => ({ id: r.id, method: r.method, amount: (assigned.get(r.id) || 0) / 100 }))
}

export interface ReconInput {
  payments: { id: string; amount: number; processing_fee?: number; status: string }[]
  paymentAllocations: { payment_id: string; amount: number }[]
  refunds: { id: string; payment_id: string | null; refund_amount: number; status: string }[]
  refundAllocations: { refund_id: string; payment_id: string; amount: number }[]
}
export type ReconSeverity = 'error' | 'warning' | 'info'
export interface ReconIssue { code: string; severity: ReconSeverity; detail: string }
export interface ReconResult {
  /** 完全干净：没有任何 error / warning / info。 */
  ok: boolean
  /** 账目平衡：钱能对上（没有 error 级问题），可能仍有待补录的 warning 或待确认的付款。 */
  balanced: boolean
  paidTotal: number
  refundedTotal: number
  /** 状态为 pending、尚未计入 paidTotal 的付款合计（未确认收款，不代表"账已收"）。 */
  pendingTotal: number
  issues: ReconIssue[]
  errors: ReconIssue[]
  warnings: ReconIssue[]
  infos: ReconIssue[]
}

// 纯函数对账：给定订单的付款 / 分配 / 退款行，分级列出问题。
//   error   —— 钱对不上：拆分不符、超退、分配指向不属于本单的付款。
//   warning —— 钱能对上，只是台账没登全（退款已关联付款但缺来源分配行）。
//   info    —— 有付款仍是 pending（未确认到账），不计入实付，但不应误报"账目一致"。
export function evaluatePaymentReconciliation(input: ReconInput): ReconResult {
  const issues: ReconIssue[] = []
  const EPS = 1 // 1 分容差
  const paidPayments = input.payments.filter(p => p.status === 'paid' || p.status === 'refunded')
  const paidTotalC = paidPayments.reduce((s, p) => s + toCents(p.amount), 0)
  const paymentIds = new Set(input.payments.map(p => p.id))

  const pendingPayments = input.payments.filter(p => p.status === 'pending')
  const pendingTotalC = pendingPayments.reduce((s, p) => s + toCents(p.amount), 0)
  for (const p of pendingPayments) {
    issues.push({ code: 'PENDING_PAYMENT', severity: 'info', detail: `付款 ${p.id}（${money(toCents(p.amount))}）状态为待确认（pending），尚未计入实付统计` })
  }

  for (const p of paidPayments) {
    const allocC = input.paymentAllocations.filter(a => a.payment_id === p.id).reduce((s, a) => s + toCents(a.amount), 0)
    // payment.amount includes the card processing fee, while allocation rows
    // represent the business components (rental/deposit) before that fee.
    const allocatedPaymentC = toCents(p.amount) - toCents(p.processing_fee || 0)
    if (allocC > 0 && Math.abs(allocC - allocatedPaymentC) > EPS) {
      issues.push({ code: 'ALLOCATION_MISMATCH', severity: 'error', detail: `付款 ${p.id} 实付 ${money(allocatedPaymentC)}（含手续费 ${money(toCents(p.processing_fee || 0))}），拆分合计却是 ${money(allocC)}` })
    }
    const refundedC = input.refundAllocations.filter(r => r.payment_id === p.id).reduce((s, r) => s + toCents(r.amount), 0)
    if (refundedC - toCents(p.amount) > EPS) {
      issues.push({ code: 'OVER_REFUND_SOURCE', severity: 'error', detail: `付款 ${p.id} 已退 ${money(refundedC)}，超过实付 ${money(toCents(p.amount))}` })
    }
  }

  const succeededRefunds = input.refunds.filter(r => r.status === 'succeeded')
  const refundedTotalC = succeededRefunds.reduce((s, r) => s + toCents(r.refund_amount), 0)
  if (refundedTotalC - paidTotalC > EPS) {
    issues.push({ code: 'OVER_REFUND_ORDER', severity: 'error', detail: `订单累计退款 ${money(refundedTotalC)}，超过累计实付 ${money(paidTotalC)}` })
  }
  for (const ra of input.refundAllocations) {
    if (!paymentIds.has(ra.payment_id)) issues.push({ code: 'ORPHAN_REFUND_ALLOCATION', severity: 'error', detail: `退款分配 ${ra.refund_id} 指向的付款 ${ra.payment_id} 不属于本订单` })
  }
  for (const r of succeededRefunds) {
    const hasAlloc = input.refundAllocations.some(ra => ra.refund_id === r.id)
    if (hasAlloc) continue
    const amount = money(toCents(r.refund_amount))
    const linkedToOrder = r.payment_id != null && paymentIds.has(r.payment_id)
    const detail = linkedToOrder
      ? `退款 ${r.id}（${amount}）已关联付款 ${r.payment_id}，但尚未登记来源分配台账（待补录）`
      : `退款 ${r.id}（${amount}）未关联本单任何付款来源，需人工核对退款渠道`
    issues.push({ code: 'UNALLOCATED_REFUND', severity: 'warning', detail })
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')
  return {
    ok: issues.length === 0,
    balanced: errors.length === 0,
    paidTotal: paidTotalC / 100,
    refundedTotal: refundedTotalC / 100,
    pendingTotal: pendingTotalC / 100,
    issues,
    errors,
    warnings,
    infos,
  }
}
